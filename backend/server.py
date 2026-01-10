from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Union
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging FIRST (before any logging calls)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'nurse-visit-secret-key-2024')
if JWT_SECRET == 'nurse-visit-secret-key-2024':
    logger.warning("JWT_SECRET not found in environment variables, using default (NOT SECURE FOR PRODUCTION)")
JWT_ALGORITHM = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== AUTH MODELS ====================
class NurseRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    title: str  # DSP, CNA, LPN, RN, BSN
    license_number: Optional[str] = None

class NurseLogin(BaseModel):
    email: EmailStr
    password: str

class NurseResponse(BaseModel):
    id: str
    email: str
    full_name: str
    title: str = "RN"
    license_number: Optional[str] = None
    is_admin: bool = False
    created_at: str

class TokenResponse(BaseModel):
    token: str
    nurse: NurseResponse

class NurseListResponse(BaseModel):
    id: str
    email: str
    full_name: str
    title: str = "RN"
    license_number: Optional[str] = None
    is_admin: bool = False
    assigned_patients: List[str] = []  # List of patient IDs
    assigned_organizations: List[str] = []  # List of organizations
    allowed_forms: List[str] = []  # List of form types allowed

# ==================== PATIENT MODELS ====================
class PatientPermanentInfo(BaseModel):
    organization: Optional[str] = None  # POSH-Able Living, Ebenezer Private HomeCare, or custom - REQUIRED first field
    # Mandatory fields
    gender: Optional[str] = None  # MANDATORY
    date_of_birth: Optional[str] = None  # MANDATORY
    # Living situation
    living_situation: Optional[str] = None  # private_home, host_home, group_home, personal_care_home, other
    living_situation_other: Optional[str] = None
    home_address: Optional[str] = None  # Legacy field
    home_street_address: Optional[str] = None  # New field
    home_city_state_zip: Optional[str] = None
    home_address_type: Optional[str] = None
    # Adult Day Program
    attends_adult_day_program: Optional[bool] = False
    adult_day_program_name: Optional[str] = None
    adult_day_program_address: Optional[str] = None  # Legacy field
    adult_day_street_address: Optional[str] = None  # New field
    adult_day_city_state_zip: Optional[str] = None
    # Other info
    race: Optional[str] = None
    height: Optional[str] = None
    caregiver_name: Optional[str] = None
    caregiver_phone: Optional[str] = None
    medications: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    medical_diagnoses: Optional[List[str]] = []
    psychiatric_diagnoses: Optional[List[str]] = []
    visit_frequency: Optional[str] = None
    additional_information: Optional[str] = None

class PatientCreate(BaseModel):
    full_name: str
    organization: str  # Required - moved to top level for creation
    permanent_info: PatientPermanentInfo = PatientPermanentInfo()

class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    permanent_info: Optional[PatientPermanentInfo] = None
    assigned_nurses: Optional[List[str]] = None  # List of nurse IDs

class PatientResponse(BaseModel):
    id: str
    full_name: str
    permanent_info: PatientPermanentInfo
    nurse_id: str  # Creator/admin who added
    assigned_nurses: List[str] = []  # List of assigned nurse IDs
    created_at: str
    updated_at: str
    last_vitals: Optional[dict] = None
    last_vitals_date: Optional[str] = None
    last_visit_date: Optional[str] = None
    last_utc: Optional[dict] = None  # last unable to contact record
    is_assigned_to_me: bool = False  # Computed field for current user

# ==================== VISIT MODELS ====================
class VitalSigns(BaseModel):
    height: Optional[str] = None  # Should persist from initial visit
    weight: Optional[str] = None
    body_temperature: Optional[str] = None
    blood_pressure_systolic: Optional[str] = None
    blood_pressure_diastolic: Optional[str] = None
    pulse_oximeter: Optional[str] = None
    pulse: Optional[str] = None
    respirations: Optional[str] = None
    repeat_blood_pressure_systolic: Optional[str] = None
    repeat_blood_pressure_diastolic: Optional[str] = None
    bp_abnormal: Optional[bool] = False  # sys >= 140 or dia >= 90 or sys < 90 or dia < 60

class SkinAssessment(BaseModel):
    skin_turgor: Optional[str] = None
    integrity_wnl: Optional[bool] = False
    integrity_rash: Optional[bool] = False
    integrity_discolored: Optional[bool] = False
    integrity_bruised: Optional[bool] = False
    integrity_burns: Optional[bool] = False
    integrity_open_areas: Optional[bool] = False
    integrity_lacerations: Optional[bool] = False
    integrity_thick: Optional[bool] = False
    integrity_thin: Optional[bool] = False
    integrity_lesions_flat: Optional[bool] = False
    integrity_lesions_raised: Optional[bool] = False
    other_notes: Optional[str] = None

class HeadNeckAssessment(BaseModel):
    within_normal_limits: Optional[bool] = False
    wounds: Optional[bool] = False
    masses: Optional[bool] = False
    alopecia: Optional[bool] = False
    other: Optional[bool] = False
    other_notes: Optional[str] = None

class PhysicalAssessment(BaseModel):
    general_appearance: Optional[str] = None
    general_appearance_from_last: Optional[bool] = False  # Pull from last visit
    skin_assessment: Optional[SkinAssessment] = None
    skin_assessment_from_last: Optional[bool] = False
    mobility_level: Optional[str] = None  # ambulatory, supervised, with_assistance, wheelchair, paralyzed, non_ambulatory
    mobility_level_from_last: Optional[bool] = False
    speech_level: Optional[str] = None  # clear_coherent_verbal, slurred, impaired, non_verbal, asl_sign, speech_impediment
    speech_level_from_last: Optional[bool] = False
    alert_oriented_level: Optional[str] = None  # 0-4
    alert_oriented_level_from_last: Optional[bool] = False
    # Gait monitoring
    gait_status: Optional[str] = None  # no_falls, uneventful_falls, eventful_falls
    fall_incidence_since_last_visit: Optional[str] = None

class EyesVisionAssessment(BaseModel):
    pupils_perrla: Optional[str] = None
    no_issues: Optional[bool] = False
    glasses: Optional[bool] = False
    contacts: Optional[bool] = False
    blurred_vision: Optional[bool] = False
    glaucoma: Optional[bool] = False
    prosthesis: Optional[bool] = False
    blind_eyes: Optional[bool] = False
    blind_which: Optional[str] = None  # 'left', 'right', 'both'
    cataract_surgery: Optional[bool] = False
    infections: Optional[bool] = False
    other: Optional[bool] = False
    other_notes: Optional[str] = None

class EarsHearingAssessment(BaseModel):
    no_issues: Optional[bool] = False
    deaf: Optional[bool] = False
    deaf_which: Optional[str] = None  # 'left', 'right', 'both'
    hard_of_hearing: Optional[bool] = False
    hearing_aid: Optional[bool] = False
    vertigo: Optional[bool] = False
    tinnitus: Optional[bool] = False
    infections: Optional[bool] = False
    other: Optional[bool] = False
    other_notes: Optional[str] = None

class MouthOralAssessment(BaseModel):
    no_issues: Optional[bool] = False
    dentures: Optional[bool] = False
    dentures_type: Optional[str] = ""  # 'upper', 'lower', 'partial', 'full'
    poor_dentition: Optional[bool] = False
    mouth_sores: Optional[bool] = False
    dry_mouth: Optional[bool] = False
    thrush: Optional[bool] = False
    other: Optional[bool] = False
    other_notes: Optional[str] = ""

class NoseNasalCavityAssessment(BaseModel):
    wnl: Optional[bool] = False
    congestion: Optional[bool] = False
    discharge: Optional[bool] = False
    bleeding: Optional[bool] = False
    deviated_septum: Optional[bool] = False
    polyps: Optional[bool] = False

class HeadToToeAssessment(BaseModel):
    head_neck: Optional[HeadNeckAssessment] = None
    head_neck_from_last: Optional[bool] = False
    eyes_vision: Optional[EyesVisionAssessment] = None
    eyes_vision_from_last: Optional[bool] = False
    ears_hearing: Optional[EarsHearingAssessment] = None
    ears_hearing_from_last: Optional[bool] = False
    nose_nasal_cavity: Optional[Union[str, dict, NoseNasalCavityAssessment]] = ""  # Support both string and object
    nose_nasal_cavity_from_last: Optional[bool] = False
    mouth_teeth_oral_cavity: Optional[MouthOralAssessment] = None
    mouth_teeth_oral_cavity_from_last: Optional[bool] = False

class GastrointestinalAssessment(BaseModel):
    last_bowel_movement: Optional[str] = None
    bowel_sounds: Optional[str] = None
    nutritional_diet: Optional[str] = None  # regular, puree/blended, tube, dash, restricted fluids

class GenitoUrinaryAssessment(BaseModel):
    toileting_level: Optional[str] = None  # self, catheter, adult diapers

class RespiratoryAssessment(BaseModel):
    lung_sounds: Optional[str] = None
    oxygen_type: Optional[str] = None  # room air, nasal cannula, mask, bipap, cpap

class EndocrineAssessment(BaseModel):
    is_diabetic: Optional[bool] = False
    diabetic_notes: Optional[str] = None
    blood_sugar: Optional[str] = None
    blood_sugar_date: Optional[str] = None  # Date of reading
    blood_sugar_time_of_day: Optional[str] = None  # AM or PM

class ChangesSinceLastVisit(BaseModel):
    medication_changes: Optional[str] = None
    diagnosis_changes: Optional[str] = None
    er_urgent_care_visits: Optional[str] = None
    upcoming_appointments: Optional[str] = None

class LogbookItem(BaseModel):
    reviewed: Optional[bool] = False
    unavailable: Optional[bool] = False
    not_applicable: Optional[bool] = False

class HomeVisitLogbook(BaseModel):
    locked_meds: LogbookItem = LogbookItem()
    mar: LogbookItem = LogbookItem()
    blood_glucose: LogbookItem = LogbookItem()
    bowel_movement: LogbookItem = LogbookItem()
    vital_signs: LogbookItem = LogbookItem()
    seizure: LogbookItem = LogbookItem()
    other: LogbookItem = LogbookItem()
    other_description: Optional[str] = None
    notes: Optional[str] = None
    
    # Legacy fields for backwards compatibility
    locked_meds_checked: Optional[bool] = False
    mar_reviewed: Optional[bool] = False
    bm_log_checked: Optional[bool] = False
    communication_log_checked: Optional[bool] = False
    seizure_log_checked: Optional[bool] = False

class VisitCreate(BaseModel):
    visit_date: Optional[str] = None
    visit_type: str = "nurse_visit"  # nurse_visit, vitals_only, daily_note
    nurse_visit_type: Optional[str] = None  # rn_clinical_oversight, skilled_nursing_management, other
    nurse_visit_type_other: Optional[str] = None
    organization: Optional[str] = None  # POSH-Able Living, Ebenezer Private Home Care
    visit_location: Optional[str] = None  # home, day_program, other
    visit_location_other: Optional[str] = None
    vital_signs: VitalSigns = VitalSigns()
    physical_assessment: PhysicalAssessment = PhysicalAssessment()
    head_to_toe: HeadToToeAssessment = HeadToToeAssessment()
    gastrointestinal: GastrointestinalAssessment = GastrointestinalAssessment()
    genito_urinary: GenitoUrinaryAssessment = GenitoUrinaryAssessment()
    respiratory: RespiratoryAssessment = RespiratoryAssessment()
    endocrine: EndocrineAssessment = EndocrineAssessment()
    changes_since_last: ChangesSinceLastVisit = ChangesSinceLastVisit()
    home_visit_logbook: HomeVisitLogbook = HomeVisitLogbook()
    overall_health_status: Optional[str] = None  # stable, unstable, deteriorating, needs immediate attention
    nurse_notes: Optional[str] = None
    daily_note_content: Optional[str] = None  # For daily notes
    status: str = "completed"  # draft or completed
    attachments: Optional[List[str]] = []  # List of file IDs
    screening_completed_by: Optional[str] = None
    reviewed_and_signed_by: Optional[str] = None

class VisitResponse(BaseModel):
    id: str
    patient_id: str
    nurse_id: str
    visit_date: str
    visit_type: str = "nurse_visit"
    nurse_visit_type: Optional[str] = None
    nurse_visit_type_other: Optional[str] = None
    organization: Optional[str] = None
    visit_location: Optional[str] = None
    visit_location_other: Optional[str] = None
    vital_signs: VitalSigns
    physical_assessment: PhysicalAssessment
    head_to_toe: HeadToToeAssessment
    gastrointestinal: GastrointestinalAssessment
    genito_urinary: GenitoUrinaryAssessment
    respiratory: RespiratoryAssessment
    endocrine: EndocrineAssessment
    changes_since_last: ChangesSinceLastVisit
    home_visit_logbook: HomeVisitLogbook = HomeVisitLogbook()
    overall_health_status: Optional[str] = None
    nurse_notes: Optional[str] = None
    daily_note_content: Optional[str] = None
    status: str = "completed"  # draft or completed
    attachments: List[str] = []
    screening_completed_by: Optional[str] = None
    reviewed_and_signed_by: Optional[str] = None
    created_at: str

# ==================== INTERVENTION MODELS ====================
class InjectionDetails(BaseModel):
    is_vaccination: bool = False
    vaccination_type: Optional[str] = None  # Flu, Covid, tDap, Tetanus, Other
    vaccination_other: Optional[str] = None
    non_vaccination_type: Optional[str] = None  # Cyanocobalamin/B-12, Other
    non_vaccination_other: Optional[str] = None
    dose: Optional[str] = None
    route: Optional[str] = None  # IM, SubQ, ID, IV
    site: Optional[str] = None
    # Injection-specific acknowledgments
    verified_no_allergic_reaction: bool = False
    cleaned_injection_site: bool = False
    adhered_8_rights: bool = False

class TestDetails(BaseModel):
    test_type: str  # blood_glucose, hcg, tb_placing, tb_reading, rapid_strep, covid, flu, throat_culture, dna, vision, hearing, other
    test_other: Optional[str] = None
    tb_placement_site: Optional[str] = None
    tb_arm: Optional[str] = None  # Left, Right
    result: Optional[str] = None
    notes: Optional[str] = None

class TreatmentDetails(BaseModel):
    treatment_type: str  # nebulizer, spirometry, epipen, insulin_fast, other
    treatment_other: Optional[str] = None
    notes: Optional[str] = None

class ProcedureDetails(BaseModel):
    procedure_type: str  # suture_removal, cerumen_removal, wound_dressing, other
    procedure_other: Optional[str] = None
    body_site: Optional[str] = None
    suture_count: Optional[int] = None
    ear_side: Optional[str] = None  # Left, Right, Both
    notes: Optional[str] = None

class InterventionCreate(BaseModel):
    patient_id: str
    intervention_date: str
    intervention_time: Optional[str] = None  # NEW: Time field
    location: str  # home, adult_day_center
    body_temperature: Optional[str] = None
    mood_scale: Optional[int] = None  # 1-5
    intervention_type: str  # injection, test, treatment, procedure
    injection_details: Optional[InjectionDetails] = None
    test_details: Optional[TestDetails] = None
    treatment_details: Optional[TreatmentDetails] = None
    procedure_details: Optional[ProcedureDetails] = None
    # Universal acknowledgments
    verified_patient_identity: bool = False
    donned_proper_ppe: bool = False
    # Post-intervention observations (select all that apply)
    post_no_severe_symptoms: bool = False
    post_tolerated_well: bool = False
    post_informed_side_effects: bool = False
    post_advised_results_timeframe: bool = False
    post_educated_seek_care: bool = False
    # Intervention completion status
    completion_status: Optional[str] = None  # only_one, series_ongoing, series_completed
    next_visit_interval: Optional[str] = None  # day, week, month, 3_months, 6_months, 12_months, other
    next_visit_interval_other: Optional[str] = None
    # Who was present
    present_person_type: Optional[str] = None  # parent_guardian, caregiver, staff, family, other
    present_person_type_other: Optional[str] = None
    present_person_name: Optional[str] = None
    # Additional comments
    additional_comments: Optional[str] = None
    notes: Optional[str] = None

class InterventionResponse(BaseModel):
    id: str
    patient_id: str
    patient_name: Optional[str] = None
    patient_dob: Optional[str] = None
    nurse_id: str
    intervention_date: str
    intervention_time: Optional[str] = None  # NEW: Time field
    location: str
    body_temperature: Optional[str] = None
    mood_scale: Optional[int] = None
    intervention_type: str
    injection_details: Optional[dict] = None
    test_details: Optional[dict] = None
    treatment_details: Optional[dict] = None
    procedure_details: Optional[dict] = None
    verified_patient_identity: bool = False
    donned_proper_ppe: bool = False
    post_no_severe_symptoms: bool = False
    post_tolerated_well: bool = False
    post_informed_side_effects: bool = False
    post_advised_results_timeframe: bool = False
    post_educated_seek_care: bool = False
    completion_status: Optional[str] = None
    next_visit_interval: Optional[str] = None
    next_visit_interval_other: Optional[str] = None
    present_person_type: Optional[str] = None
    present_person_type_other: Optional[str] = None
    present_person_name: Optional[str] = None
    additional_comments: Optional[str] = None
    notes: Optional[str] = None
    created_at: str

# ==================== UNABLE TO CONTACT MODELS ====================
class UnableToContactCreate(BaseModel):
    patient_id: str
    visit_type: str  # nurse_visit, vitals_only, daily_note - prefilled reason
    attempt_date: str
    attempt_time: Optional[str] = None
    attempt_reason: Optional[str] = None  # NEW: routine_nurse_visit, patient_intervention, vitals_only, other
    attempt_location: str  # home, day_program, telephone, virtual, other
    attempt_location_other: Optional[str] = None
    spoke_with_anyone: Optional[bool] = False
    spoke_with_whom: Optional[str] = None
    individual_location: str  # admitted, medical_appointment, overnight_family, outing, moved_temporarily, moved_permanently, deceased, other
    individual_location_other: Optional[str] = None
    moved_temporarily_where: Optional[str] = None  # NEW: for moved_temporarily
    deceased_date: Optional[str] = None  # NEW: for deceased
    # Medical facility details (if admitted)
    facility_name: Optional[str] = None
    facility_city: Optional[str] = None
    facility_state: Optional[str] = None
    admission_date: Optional[str] = None
    admission_reason: Optional[str] = None
    # Expected return - available for all absence types
    expected_return_date: Optional[str] = None
    additional_info: Optional[str] = None

class UnableToContactResponse(BaseModel):
    id: str
    patient_id: str
    patient_name: Optional[str] = None
    nurse_id: str
    visit_type: str
    attempt_date: str
    attempt_time: Optional[str] = None
    attempt_reason: Optional[str] = None  # NEW
    attempt_location: str
    attempt_location_other: Optional[str] = None
    spoke_with_anyone: Optional[bool] = False
    spoke_with_whom: Optional[str] = None
    individual_location: str
    individual_location_other: Optional[str] = None
    moved_temporarily_where: Optional[str] = None  # NEW
    deceased_date: Optional[str] = None  # NEW
    facility_name: Optional[str] = None
    facility_city: Optional[str] = None
    facility_state: Optional[str] = None
    admission_date: Optional[str] = None
    admission_reason: Optional[str] = None
    expected_return_date: Optional[str] = None
    additional_info: Optional[str] = None
    created_at: str

# Organization models
class OrganizationCreate(BaseModel):
    name: str
    address: str
    contact_person: str
    contact_phone: str

class OrganizationResponse(BaseModel):
    id: str
    name: str
    address: str
    contact_person: str
    contact_phone: str
    created_at: str

# Day Program models  
class DayProgramCreate(BaseModel):
    name: str
    address: str
    office_phone: str
    contact_person: Optional[str] = None

class DayProgramResponse(BaseModel):
    id: str
    name: str
    address: str
    office_phone: str
    contact_person: Optional[str] = None
    created_at: str

# ==================== AUTH HELPERS ====================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(nurse_id: str) -> str:
    payload = {
        "nurse_id": nurse_id,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_nurse(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        nurse_id = payload.get("nurse_id")
        if not nurse_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        nurse = await db.nurses.find_one({"id": nurse_id}, {"_id": 0})
        if not nurse:
            raise HTTPException(status_code=401, detail="Nurse not found")
        return nurse
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ENDPOINTS ====================
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: NurseRegister):
    existing = await db.nurses.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if this is the first user - make them admin
    nurse_count = await db.nurses.count_documents({})
    is_admin = nurse_count == 0
    
    nurse_id = str(uuid.uuid4())
    nurse_doc = {
        "id": nurse_id,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "full_name": data.full_name,
        "title": data.title,
        "license_number": data.license_number,
        "is_admin": is_admin,
        "assigned_patients": [],
        "assigned_organizations": [],
        "allowed_forms": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.nurses.insert_one(nurse_doc)
    
    token = create_token(nurse_id)
    return TokenResponse(
        token=token,
        nurse=NurseResponse(
            id=nurse_id,
            email=data.email,
            full_name=data.full_name,
            title=data.title,
            license_number=data.license_number,
            is_admin=is_admin,
            created_at=nurse_doc["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: NurseLogin):
    logger.info(f"Login attempt for email: {data.email}")
    nurse = await db.nurses.find_one({"email": data.email})
    
    if not nurse:
        logger.warning(f"User not found: {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    logger.info(f"User found, verifying password")
    password_valid = verify_password(data.password, nurse["password_hash"])
    logger.info(f"Password valid: {password_valid}")
    
    if not password_valid:
        logger.warning(f"Invalid password for: {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(nurse["id"])
    logger.info(f"Login successful for: {data.email}")
    return TokenResponse(
        token=token,
        nurse=NurseResponse(
            id=nurse["id"],
            email=nurse["email"],
            full_name=nurse["full_name"],
            title=nurse.get("title", "RN"),
            license_number=nurse.get("license_number"),
            is_admin=nurse.get("is_admin", False),
            created_at=nurse["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=NurseResponse)
async def get_me(nurse: dict = Depends(get_current_nurse)):
    return NurseResponse(
        id=nurse["id"],
        email=nurse["email"],
        full_name=nurse["full_name"],
        title=nurse.get("title", "RN"),
        license_number=nurse.get("license_number"),
        is_admin=nurse.get("is_admin", False),
        created_at=nurse["created_at"]
    )

# ==================== ADMIN ENDPOINTS ====================
@api_router.get("/admin/nurses", response_model=List[NurseListResponse])
async def list_all_nurses(nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    nurses = await db.nurses.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [NurseListResponse(**n) for n in nurses]

@api_router.post("/admin/nurses/{nurse_id}/promote")
async def promote_to_admin(nurse_id: str, nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.nurses.update_one({"id": nurse_id}, {"$set": {"is_admin": True}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Nurse not found")
    return {"message": "Nurse promoted to admin"}

@api_router.post("/admin/nurses/{nurse_id}/demote")
async def demote_from_admin(nurse_id: str, nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Prevent demoting yourself
    if nurse_id == nurse.get("id"):
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    
    result = await db.nurses.update_one({"id": nurse_id}, {"$set": {"is_admin": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Nurse not found")
    return {"message": "Admin privileges removed"}

class NurseUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    title: Optional[str] = None
    license_number: Optional[str] = None
    email: Optional[str] = None

@api_router.put("/admin/nurses/{nurse_id}")
async def update_nurse(nurse_id: str, data: NurseUpdateRequest, nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if nurse exists first
    existing_nurse = await db.nurses.find_one({"id": nurse_id})
    if not existing_nurse:
        raise HTTPException(status_code=404, detail="Nurse not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.nurses.update_one({"id": nurse_id}, {"$set": update_data})
    return {"message": "Nurse updated successfully"}

class NurseAssignmentRequest(BaseModel):
    assigned_patients: List[str] = []
    assigned_organizations: List[str] = []
    allowed_forms: List[str] = []

@api_router.post("/admin/nurses/{nurse_id}/assignments")
async def update_nurse_assignments(nurse_id: str, data: NurseAssignmentRequest, nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if nurse exists first
    existing_nurse = await db.nurses.find_one({"id": nurse_id})
    if not existing_nurse:
        raise HTTPException(status_code=404, detail="Nurse not found")
    
    result = await db.nurses.update_one(
        {"id": nurse_id}, 
        {"$set": {
            "assigned_patients": data.assigned_patients,
            "assigned_organizations": data.assigned_organizations,
            "allowed_forms": data.allowed_forms
        }}
    )
    return {"message": "Assignments updated successfully"}

@api_router.post("/admin/patients/{patient_id}/assign")
async def assign_nurses_to_patient(patient_id: str, nurse_ids: List[str], nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.patients.update_one(
        {"id": patient_id},
        {"$set": {"assigned_nurses": nurse_ids}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"message": "Nurses assigned successfully"}

# ==================== ORGANIZATIONS ====================
@api_router.get("/admin/organizations", response_model=List[OrganizationResponse])
async def list_organizations(nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    organizations = await db.organizations.find({}, {"_id": 0}).to_list(100)
    return organizations

@api_router.post("/admin/organizations", response_model=OrganizationResponse)
async def create_organization(data: OrganizationCreate, nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    organization = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "address": data.address,
        "contact_person": data.contact_person,
        "contact_phone": data.contact_phone,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organizations.insert_one(organization)
    return OrganizationResponse(**organization)

# ==================== DAY PROGRAMS ====================
@api_router.get("/admin/day-programs", response_model=List[DayProgramResponse])
async def list_day_programs(nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    programs = await db.day_programs.find({}, {"_id": 0}).to_list(100)
    return programs

@api_router.post("/admin/day-programs", response_model=DayProgramResponse)
async def create_day_program(data: DayProgramCreate, nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    program = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "address": data.address,
        "office_phone": data.office_phone,
        "contact_person": data.contact_person,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.day_programs.insert_one(program)
    return DayProgramResponse(**program)

@api_router.put("/admin/organizations/{org_id}", response_model=OrganizationResponse)
async def update_organization(org_id: str, data: OrganizationCreate, nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.organizations.find_one({"id": org_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    update_data = {
        "name": data.name,
        "address": data.address,
        "contact_person": data.contact_person,
        "contact_phone": data.contact_phone
    }
    await db.organizations.update_one({"id": org_id}, {"$set": update_data})
    return OrganizationResponse(**{**existing, **update_data})

@api_router.put("/admin/day-programs/{program_id}", response_model=DayProgramResponse)
async def update_day_program(program_id: str, data: DayProgramCreate, nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.day_programs.find_one({"id": program_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Day program not found")
    
    update_data = {
        "name": data.name,
        "address": data.address,
        "office_phone": data.office_phone,
        "contact_person": data.contact_person
    }
    await db.day_programs.update_one({"id": program_id}, {"$set": update_data})
    return DayProgramResponse(**{**existing, **update_data})

@api_router.delete("/admin/organizations/{org_id}")
async def delete_organization(org_id: str, nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.organizations.delete_one({"id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"message": "Organization deleted successfully"}

@api_router.delete("/admin/day-programs/{program_id}")
async def delete_day_program(program_id: str, nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.day_programs.delete_one({"id": program_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Day program not found")
    return {"message": "Day program deleted successfully"}

@api_router.post("/incident-reports")
async def create_incident_report(data: dict, nurse: dict = Depends(get_current_nurse)):
    report = {
        **data,
        "id": str(uuid.uuid4()),
        "nurse_id": nurse["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.incident_reports.insert_one(report)
    return {"message": "Incident report created successfully", "id": report["id"]}

@api_router.get("/incident-reports")
async def list_incident_reports(nurse: dict = Depends(get_current_nurse)):
    if not nurse.get("is_admin"):
        # Regular staff can only see their own reports
        reports = await db.incident_reports.find({"nurse_id": nurse["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        # Admins can see all reports
        reports = await db.incident_reports.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return reports

# ==================== PATIENT ENDPOINTS ====================
@api_router.post("/patients", response_model=PatientResponse)
async def create_patient(data: PatientCreate, nurse: dict = Depends(get_current_nurse)):
    # Only admin can create patients
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only admin can add new patients")
    
    if not data.organization:
        raise HTTPException(status_code=400, detail="Organization is required")
    
    patient_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Set organization in permanent_info
    permanent_info = data.permanent_info.model_dump()
    permanent_info["organization"] = data.organization
    
    patient_doc = {
        "id": patient_id,
        "full_name": data.full_name,
        "permanent_info": permanent_info,
        "nurse_id": nurse["id"],  # Creator
        "assigned_nurses": [nurse["id"]],  # Admin is auto-assigned
        "created_at": now,
        "updated_at": now,
        "last_vitals": None
    }
    
    logger.info(f"💾 Attempting to create patient: name={data.full_name}, id={patient_id}")
    result = await db.patients.insert_one(patient_doc)
    logger.info(f"✅ Patient created successfully: inserted_id={result.inserted_id}")
    
    return PatientResponse(
        id=patient_id,
        full_name=data.full_name,
        permanent_info=PatientPermanentInfo(**permanent_info),
        nurse_id=nurse["id"],
        assigned_nurses=[nurse["id"]],
        created_at=now,
        updated_at=now,
        last_vitals=None,
        is_assigned_to_me=True
    )

@api_router.get("/patients", response_model=List[PatientResponse])
async def list_patients(nurse: dict = Depends(get_current_nurse)):
    # All nurses can see all patients, but with assignment info
    patients = await db.patients.find({}, {"_id": 0}).to_list(1000)
    
    # Enrich each patient with last visit and last UTC info
    enriched_patients = []
    for p in patients:
        # Get last visit (completed only, exclude daily_note as they are not visits)
        last_visit = await db.visits.find_one(
            {"patient_id": p["id"], "status": "completed", "visit_type": {"$ne": "daily_note"}},
            {"_id": 0, "id": 1, "visit_date": 1, "vital_signs": 1, "visit_type": 1},
            sort=[("visit_date", -1)]
        )
        
        # Get last vitals from any visit type (nurse_visit or vitals_only)
        # Remove status filter to see ALL visits with vitals
        logger.info(f"🔍 Searching vitals for patient: {p['full_name']} (id: {p['id']})")
        last_vitals_visit = await db.visits.find_one(
            {"patient_id": p["id"], "visit_type": {"$in": ["nurse_visit", "vitals_only"]}, "vital_signs": {"$exists": True}},
            {"_id": 0, "id": 1, "visit_date": 1, "vital_signs": 1, "status": 1, "visit_type": 1},
            sort=[("visit_date", -1)]
        )
        if last_vitals_visit:
            logger.info(f"  Found visit: type={last_vitals_visit.get('visit_type')}, date={last_vitals_visit.get('visit_date')}, status={last_vitals_visit.get('status')}")
        else:
            logger.warning(f"  ❌ No vitals visit found for {p['full_name']}")
        
        # Get last UTC record (sorted by created_at for precise ordering)
        last_utc = await db.unable_to_contact.find_one(
            {"patient_id": p["id"]},
            {"_id": 0, "id": 1, "attempt_date": 1, "individual_location": 1, "individual_location_other": 1},
            sort=[("created_at", -1)]
        )
        
        p["last_visit_id"] = last_visit.get("id") if last_visit else None
        p["last_visit_date"] = last_visit.get("visit_date") if last_visit else None
        
        # Use last_vitals_visit for vitals data (could be from vitals_only or nurse_visit)
        if last_vitals_visit:
            vitals = last_vitals_visit.get("vital_signs")
            vitals_visit_id = last_vitals_visit.get("id")
            vitals_visit_date = last_vitals_visit.get("visit_date")
            
            # Check if vital_signs actually has data
            if vitals and isinstance(vitals, dict) and any(vitals.values()):
                p["last_vitals"] = vitals
                p["last_vitals_date"] = vitals_visit_date
                
                # CRITICAL FIX: Always ensure last_visit_id is set when we have vitals
                # If no completed visit exists OR vitals visit is more recent, use vitals visit
                if not p["last_visit_id"] or not p["last_visit_date"] or vitals_visit_date >= p["last_visit_date"]:
                    p["last_visit_id"] = vitals_visit_id
                    logger.info(f"✅ Set vitals for {p['full_name']}: visit_id={vitals_visit_id}, BP={vitals.get('blood_pressure_systolic')}/{vitals.get('blood_pressure_diastolic')}, Temp={vitals.get('body_temperature')}")
                else:
                    logger.info(f"✅ Set vitals for {p['full_name']} (older than last visit): BP={vitals.get('blood_pressure_systolic')}/{vitals.get('blood_pressure_diastolic')}")
            else:
                p["last_vitals"] = None
                p["last_vitals_date"] = None
                logger.warning(f"❌ No valid vitals data for {p['full_name']}: vitals={vitals}")
        else:
            p["last_vitals"] = None
            p["last_vitals_date"] = None
            logger.warning(f"❌ No vitals visit found for {p['full_name']}")
        
        # Include UTC regardless of date (show most recent UTC)
        if last_utc:
            location_map = {
                "admitted": "Hospitalized",
                "medical_appointment": "Medical Appt",
                "overnight_family": "Overnight w/Family",
                "outing": "Outing",
                "moved_temporarily": "Temp Move",
                "moved_permanently": "Perm Move",
                "deceased": "Deceased",
                "other": last_utc.get("individual_location_other", "Other")
            }
            p["last_utc"] = {
                "id": last_utc.get("id"),
                "date": last_utc.get("attempt_date"),
                "reason": location_map.get(last_utc.get("individual_location"), "Unknown")
            }
        else:
            p["last_utc"] = None
        
        # Check if current nurse is assigned
        assigned_nurses = p.get("assigned_nurses", [])
        p["is_assigned_to_me"] = nurse["id"] in assigned_nurses or nurse.get("is_admin", False)
        p["assigned_nurses"] = assigned_nurses
        
        enriched_patients.append(PatientResponse(**p))
    
    return enriched_patients

@api_router.get("/patients/{patient_id}", response_model=PatientResponse)
async def get_patient(patient_id: str, nurse: dict = Depends(get_current_nurse)):
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    assigned_nurses = patient.get("assigned_nurses", [])
    patient["is_assigned_to_me"] = nurse["id"] in assigned_nurses or nurse.get("is_admin", False)
    patient["assigned_nurses"] = assigned_nurses
    
    return PatientResponse(**patient)

@api_router.put("/patients/{patient_id}", response_model=PatientResponse)
async def update_patient(patient_id: str, data: PatientUpdate, nurse: dict = Depends(get_current_nurse)):
    patient = await db.patients.find_one({"id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Check if nurse is assigned or is admin
    assigned_nurses = patient.get("assigned_nurses", [])
    if nurse["id"] not in assigned_nurses and not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient")
    
    update_data = {}
    if data.full_name:
        update_data["full_name"] = data.full_name
    if data.permanent_info:
        update_data["permanent_info"] = data.permanent_info.model_dump()
    if data.assigned_nurses is not None and nurse.get("is_admin"):
        update_data["assigned_nurses"] = data.assigned_nurses
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.patients.update_one({"id": patient_id}, {"$set": update_data})
    updated = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    updated["is_assigned_to_me"] = nurse["id"] in updated.get("assigned_nurses", []) or nurse.get("is_admin", False)
    return PatientResponse(**updated)

@api_router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, nurse: dict = Depends(get_current_nurse)):
    # Only admin can delete patients
    if not nurse.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only admin can delete patients")
    
    result = await db.patients.delete_one({"id": patient_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    # Also delete all visits, UTC records, and interventions for this patient
    await db.visits.delete_many({"patient_id": patient_id})
    await db.unable_to_contact.delete_many({"patient_id": patient_id})
    await db.interventions.delete_many({"patient_id": patient_id})
    return {"message": "Patient deleted successfully"}

# ==================== VISIT ENDPOINTS ====================
@api_router.post("/patients/{patient_id}/visits", response_model=VisitResponse)
async def create_visit(patient_id: str, data: VisitCreate, nurse: dict = Depends(get_current_nurse)):
    # Check if patient exists (admins can create for any patient, regular nurses need assignment)
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # If not admin, verify nurse is assigned to this patient
    if not nurse.get("is_admin", False):
        assigned_nurses = patient.get("assigned_nurses", [])
        if nurse["id"] not in assigned_nurses:
            raise HTTPException(status_code=403, detail="Not authorized to create visits for this patient")
    
    visit_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    visit_date = data.visit_date or now
    
    visit_doc = {
        "id": visit_id,
        "patient_id": patient_id,
        "nurse_id": nurse["id"],
        "visit_date": visit_date,
        "visit_type": data.visit_type,
        "nurse_visit_type": data.nurse_visit_type,
        "nurse_visit_type_other": data.nurse_visit_type_other,
        "organization": data.organization,
        "visit_location": data.visit_location,
        "visit_location_other": data.visit_location_other,
        "vital_signs": data.vital_signs.model_dump(),
        "physical_assessment": data.physical_assessment.model_dump(),
        "head_to_toe": data.head_to_toe.model_dump(),
        "gastrointestinal": data.gastrointestinal.model_dump(),
        "genito_urinary": data.genito_urinary.model_dump(),
        "respiratory": data.respiratory.model_dump(),
        "endocrine": data.endocrine.model_dump(),
        "changes_since_last": data.changes_since_last.model_dump(),
        "home_visit_logbook": data.home_visit_logbook.model_dump(),
        "overall_health_status": data.overall_health_status,
        "nurse_notes": data.nurse_notes,
        "daily_note_content": data.daily_note_content,
        "status": data.status,
        "attachments": data.attachments or [],
        "screening_completed_by": data.screening_completed_by,
        "reviewed_and_signed_by": data.reviewed_and_signed_by,
        "created_at": now
    }
    
    logger.info(f"💾 Attempting to save visit: patient_id={patient_id}, visit_type={data.visit_type}, visit_id={visit_id}")
    result = await db.visits.insert_one(visit_doc)
    logger.info(f"✅ Visit saved successfully: inserted_id={result.inserted_id}")
    
    # Update patient's last_vitals
    logger.info(f"💾 Updating patient last_vitals for patient_id={patient_id}")
    update_result = await db.patients.update_one(
        {"id": patient_id},
        {"$set": {
            "last_vitals": data.vital_signs.model_dump(),
            "updated_at": now
        }}
    )
    
    return VisitResponse(
        id=visit_id,
        patient_id=patient_id,
        nurse_id=nurse["id"],
        visit_date=visit_date,
        visit_type=data.visit_type,
        nurse_visit_type=data.nurse_visit_type,
        nurse_visit_type_other=data.nurse_visit_type_other,
        organization=data.organization,
        visit_location=data.visit_location,
        visit_location_other=data.visit_location_other,
        vital_signs=data.vital_signs,
        physical_assessment=data.physical_assessment,
        head_to_toe=data.head_to_toe,
        gastrointestinal=data.gastrointestinal,
        genito_urinary=data.genito_urinary,
        respiratory=data.respiratory,
        endocrine=data.endocrine,
        changes_since_last=data.changes_since_last,
        home_visit_logbook=data.home_visit_logbook,
        overall_health_status=data.overall_health_status,
        nurse_notes=data.nurse_notes,
        daily_note_content=data.daily_note_content,
        status=data.status,
        attachments=data.attachments or [],
        screening_completed_by=data.screening_completed_by,
        reviewed_and_signed_by=data.reviewed_and_signed_by,
        created_at=now
    )

@api_router.get("/patients/{patient_id}/visits", response_model=List[VisitResponse])
async def list_visits(patient_id: str, nurse: dict = Depends(get_current_nurse)):
    # Check if patient exists (admins can see all patients, regular nurses need to be assigned)
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # If not admin, verify nurse is assigned to this patient
    if not nurse.get("is_admin", False):
        assigned_nurses = patient.get("assigned_nurses", [])
        if nurse["id"] not in assigned_nurses:
            raise HTTPException(status_code=403, detail="Not authorized to view this patient's visits")
    
    visits = await db.visits.find({"patient_id": patient_id}, {"_id": 0}).sort("visit_date", -1).to_list(1000)
    return [VisitResponse(**v) for v in visits]

@api_router.get("/visits/{visit_id}", response_model=VisitResponse)
async def get_visit(visit_id: str, nurse: dict = Depends(get_current_nurse)):
    # Allow any authenticated user to view visits (not just the creator)
    visit = await db.visits.find_one({"id": visit_id}, {"_id": 0})
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    # Verify user has access to this patient
    patient = await db.patients.find_one({"id": visit["patient_id"]}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Check if nurse has access (is admin OR is assigned to patient)
    is_admin = nurse.get("is_admin", False)
    is_assigned = nurse["id"] in patient.get("assigned_nurses", [])
    if not (is_admin or is_assigned):
        raise HTTPException(status_code=403, detail="Not authorized to view this visit")
    
    return VisitResponse(**visit)

@api_router.delete("/visits/{visit_id}")
async def delete_visit(visit_id: str, nurse: dict = Depends(get_current_nurse)):
    result = await db.visits.delete_one({"id": visit_id, "nurse_id": nurse["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Visit not found")
    return {"message": "Visit deleted successfully"}

@api_router.put("/visits/{visit_id}", response_model=VisitResponse)
async def update_visit(visit_id: str, data: VisitCreate, nurse: dict = Depends(get_current_nurse)):
    visit = await db.visits.find_one({"id": visit_id, "nurse_id": nurse["id"]})
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    update_doc = {
        "visit_date": data.visit_date or visit["visit_date"],
        "visit_type": data.visit_type,
        "organization": data.organization,
        "vital_signs": data.vital_signs.model_dump(),
        "physical_assessment": data.physical_assessment.model_dump(),
        "head_to_toe": data.head_to_toe.model_dump(),
        "gastrointestinal": data.gastrointestinal.model_dump(),
        "genito_urinary": data.genito_urinary.model_dump(),
        "respiratory": data.respiratory.model_dump(),
        "endocrine": data.endocrine.model_dump(),
        "changes_since_last": data.changes_since_last.model_dump(),
        "home_visit_logbook": data.home_visit_logbook.model_dump(),
        "overall_health_status": data.overall_health_status,
        "nurse_notes": data.nurse_notes,
        "daily_note_content": data.daily_note_content,
        "status": data.status,
        "attachments": data.attachments or [],
    }
    
    await db.visits.update_one({"id": visit_id}, {"$set": update_doc})
    updated = await db.visits.find_one({"id": visit_id}, {"_id": 0})
    return VisitResponse(**updated)

@api_router.get("/patients/{patient_id}/visits/last", response_model=VisitResponse)
async def get_last_visit(patient_id: str, nurse: dict = Depends(get_current_nurse)):
    """Get the most recent completed visit for a patient (for pulling data from last visit)"""
    visit = await db.visits.find_one(
        {"patient_id": patient_id, "status": "completed"},
        {"_id": 0},
        sort=[("visit_date", -1)]
    )
    if not visit:
        raise HTTPException(status_code=404, detail="No previous visits found")
    return VisitResponse(**visit)

# ==================== UNABLE TO CONTACT ENDPOINTS ====================
@api_router.post("/unable-to-contact", response_model=UnableToContactResponse)
async def create_unable_to_contact(data: UnableToContactCreate, nurse: dict = Depends(get_current_nurse)):
    # Verify patient exists and nurse has access
    patient = await db.patients.find_one({"id": data.patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Check if nurse has access (is admin OR is assigned to patient)
    is_admin = nurse.get("is_admin", False)
    is_assigned = nurse["id"] in patient.get("assigned_nurses", [])
    if not (is_admin or is_assigned):
        raise HTTPException(status_code=403, detail="Not authorized to create records for this patient")
    
    record_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    record_doc = {
        "id": record_id,
        "patient_id": data.patient_id,
        "nurse_id": nurse["id"],
        "visit_type": data.visit_type,
        "attempt_date": data.attempt_date,
        "attempt_time": data.attempt_time,
        "attempt_reason": data.attempt_reason,
        "attempt_location": data.attempt_location,
        "attempt_location_other": data.attempt_location_other,
        "spoke_with_anyone": data.spoke_with_anyone,
        "spoke_with_whom": data.spoke_with_whom,
        "individual_location": data.individual_location,
        "individual_location_other": data.individual_location_other,
        "moved_temporarily_where": data.moved_temporarily_where,
        "deceased_date": data.deceased_date,
        "facility_name": data.facility_name,
        "facility_city": data.facility_city,
        "facility_state": data.facility_state,
        "expected_return_date": data.expected_return_date,
        "admission_date": data.admission_date,
        "admission_reason": data.admission_reason,
        "additional_info": data.additional_info,
        "created_at": now
    }
    await db.unable_to_contact.insert_one(record_doc)
    
    return UnableToContactResponse(
        id=record_id,
        patient_id=data.patient_id,
        patient_name=patient.get("full_name"),
        nurse_id=nurse["id"],
        visit_type=data.visit_type,
        attempt_date=data.attempt_date,
        attempt_time=data.attempt_time,
        attempt_reason=data.attempt_reason,
        attempt_location=data.attempt_location,
        attempt_location_other=data.attempt_location_other,
        spoke_with_anyone=data.spoke_with_anyone,
        spoke_with_whom=data.spoke_with_whom,
        individual_location=data.individual_location,
        individual_location_other=data.individual_location_other,
        moved_temporarily_where=data.moved_temporarily_where,
        deceased_date=data.deceased_date,
        facility_name=data.facility_name,
        facility_city=data.facility_city,
        facility_state=data.facility_state,
        expected_return_date=data.expected_return_date,
        admission_date=data.admission_date,
        admission_reason=data.admission_reason,
        additional_info=data.additional_info,
        created_at=now
    )

@api_router.get("/patients/{patient_id}/unable-to-contact", response_model=List[UnableToContactResponse])
async def list_unable_to_contact(patient_id: str, nurse: dict = Depends(get_current_nurse)):
    # Check if patient exists (admins can see all patients, regular nurses need to be assigned)
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # If not admin, verify nurse is assigned to this patient
    if not nurse.get("is_admin", False):
        assigned_nurses = patient.get("assigned_nurses", [])
        if nurse["id"] not in assigned_nurses:
            raise HTTPException(status_code=403, detail="Not authorized to view this patient's records")
    
    records = await db.unable_to_contact.find({"patient_id": patient_id}, {"_id": 0}).sort("attempt_date", -1).to_list(1000)
    for r in records:
        r["patient_name"] = patient.get("full_name")
    return [UnableToContactResponse(**r) for r in records]

@api_router.get("/unable-to-contact/{record_id}", response_model=UnableToContactResponse)
async def get_unable_to_contact(record_id: str, nurse: dict = Depends(get_current_nurse)):
    # Find the UTC record (don't filter by nurse_id - allow all authorized users to view)
    record = await db.unable_to_contact.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # Get patient info
    patient = await db.patients.find_one({"id": record["patient_id"]}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Check if current nurse has access to this patient
    is_assigned = nurse["id"] in patient.get("assigned_nurses", [])
    is_admin = nurse.get("is_admin", False)
    has_org_access = patient.get("permanent_info", {}).get("organization") in nurse.get("assigned_organizations", [])
    
    if not (is_assigned or is_admin or has_org_access):
        raise HTTPException(status_code=403, detail="Not authorized to view this record")
    
    record["patient_name"] = patient.get("full_name", "Unknown")
    return UnableToContactResponse(**record)

@api_router.delete("/unable-to-contact/{record_id}")
async def delete_unable_to_contact(record_id: str, nurse: dict = Depends(get_current_nurse)):
    result = await db.unable_to_contact.delete_one({"id": record_id, "nurse_id": nurse["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Record deleted successfully"}

# ==================== INTERVENTION ENDPOINTS ====================
@api_router.post("/interventions", response_model=InterventionResponse)
async def create_intervention(data: InterventionCreate, nurse: dict = Depends(get_current_nurse)):
    # Verify patient exists and nurse has access
    patient = await db.patients.find_one({"id": data.patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Check if nurse has access (is admin OR is assigned to patient)
    is_admin = nurse.get("is_admin", False)
    is_assigned = nurse["id"] in patient.get("assigned_nurses", [])
    if not (is_admin or is_assigned):
        raise HTTPException(status_code=403, detail="Not authorized to create interventions for this patient")
    
    intervention_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    intervention_doc = {
        "id": intervention_id,
        "patient_id": data.patient_id,
        "nurse_id": nurse["id"],
        "intervention_date": data.intervention_date,
        "intervention_time": data.intervention_time,
        "location": data.location,
        "body_temperature": data.body_temperature,
        "mood_scale": data.mood_scale,
        "intervention_type": data.intervention_type,
        "injection_details": data.injection_details.model_dump() if data.injection_details else None,
        "test_details": data.test_details.model_dump() if data.test_details else None,
        "treatment_details": data.treatment_details.model_dump() if data.treatment_details else None,
        "procedure_details": data.procedure_details.model_dump() if data.procedure_details else None,
        "verified_patient_identity": data.verified_patient_identity,
        "donned_proper_ppe": data.donned_proper_ppe,
        "notes": data.notes,
        "created_at": now
    }
    await db.interventions.insert_one(intervention_doc)
    
    return InterventionResponse(
        id=intervention_id,
        patient_id=data.patient_id,
        patient_name=patient.get("full_name"),
        patient_dob=patient.get("permanent_info", {}).get("date_of_birth"),
        nurse_id=nurse["id"],
        intervention_date=data.intervention_date,
        intervention_time=data.intervention_time,
        location=data.location,
        body_temperature=data.body_temperature,
        mood_scale=data.mood_scale,
        intervention_type=data.intervention_type,
        injection_details=data.injection_details.model_dump() if data.injection_details else None,
        test_details=data.test_details.model_dump() if data.test_details else None,
        treatment_details=data.treatment_details.model_dump() if data.treatment_details else None,
        procedure_details=data.procedure_details.model_dump() if data.procedure_details else None,
        verified_patient_identity=data.verified_patient_identity,
        donned_proper_ppe=data.donned_proper_ppe,
        notes=data.notes,
        created_at=now
    )

@api_router.get("/patients/{patient_id}/interventions", response_model=List[InterventionResponse])
async def list_interventions(patient_id: str, nurse: dict = Depends(get_current_nurse)):
    # Verify patient exists and nurse has access
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Check if nurse has access (is admin OR is assigned to patient)
    is_admin = nurse.get("is_admin", False)
    is_assigned = nurse["id"] in patient.get("assigned_nurses", [])
    if not (is_admin or is_assigned):
        raise HTTPException(status_code=403, detail="Not authorized to view this patient's interventions")
    
    interventions = await db.interventions.find({"patient_id": patient_id}, {"_id": 0}).sort("intervention_date", -1).to_list(1000)
    for i in interventions:
        i["patient_name"] = patient.get("full_name")
        i["patient_dob"] = patient.get("permanent_info", {}).get("date_of_birth")
    return [InterventionResponse(**i) for i in interventions]

@api_router.get("/interventions/{intervention_id}", response_model=InterventionResponse)
async def get_intervention(intervention_id: str, nurse: dict = Depends(get_current_nurse)):
    intervention = await db.interventions.find_one({"id": intervention_id, "nurse_id": nurse["id"]}, {"_id": 0})
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")
    patient = await db.patients.find_one({"id": intervention["patient_id"]}, {"_id": 0})
    intervention["patient_name"] = patient.get("full_name") if patient else "Unknown"
    intervention["patient_dob"] = patient.get("permanent_info", {}).get("date_of_birth") if patient else None
    return InterventionResponse(**intervention)

@api_router.put("/interventions/{intervention_id}", response_model=InterventionResponse)
async def update_intervention(intervention_id: str, intervention: InterventionCreate, nurse: dict = Depends(get_current_nurse)):
    # Verify intervention exists and belongs to this nurse
    existing = await db.interventions.find_one({"id": intervention_id, "nurse_id": nurse["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Intervention not found")
    
    # Update the intervention data
    update_data = intervention.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.interventions.update_one(
        {"id": intervention_id},
        {"$set": update_data}
    )
    
    # Fetch updated intervention
    updated = await db.interventions.find_one({"id": intervention_id}, {"_id": 0})
    
    # Add patient info
    patient = await db.patients.find_one({"id": updated["patient_id"]}, {"_id": 0})
    updated["patient_name"] = patient.get("full_name") if patient else "Unknown"
    updated["patient_dob"] = patient.get("permanent_info", {}).get("date_of_birth") if patient else None
    
    logger.info(f"Intervention {intervention_id} updated by nurse {nurse['id']}")
    return InterventionResponse(**updated)

@api_router.delete("/interventions/{intervention_id}")
async def delete_intervention(intervention_id: str, nurse: dict = Depends(get_current_nurse)):
    result = await db.interventions.delete_one({"id": intervention_id, "nurse_id": nurse["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return {"message": "Intervention deleted successfully"}

# ==================== MONTHLY REPORTS ====================
class MonthlyReportRequest(BaseModel):
    year: int
    month: int
    patient_id: Optional[str] = None  # Optional: filter by specific patient
    organization: Optional[str] = None  # Optional: filter by organization
    visit_type: Optional[str] = None  # Optional: filter by visit type (daily_note, vitals_only)

@api_router.post("/reports/monthly")
async def get_monthly_report(data: MonthlyReportRequest, nurse: dict = Depends(get_current_nurse)):
    from datetime import date
    import calendar
    
    # Calculate date range
    _, last_day = calendar.monthrange(data.year, data.month)
    start_date = f"{data.year}-{data.month:02d}-01"
    end_date = f"{data.year}-{data.month:02d}-{last_day:02d}"
    
    # Check if it's current month - use today's date as end
    today = date.today()
    if data.year == today.year and data.month == today.month:
        end_date = today.isoformat()
    
    # Build query
    query = {
        "nurse_id": nurse["id"],
        "visit_date": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
    }
    
    if data.patient_id:
        query["patient_id"] = data.patient_id
    
    if data.organization:
        query["organization"] = data.organization
    
    if data.visit_type:
        query["visit_type"] = data.visit_type
    
    # Get visits
    visits = await db.visits.find(query, {"_id": 0}).sort("visit_date", 1).to_list(10000)
    
    # Get patient info for each visit
    patient_ids = list(set(v["patient_id"] for v in visits))
    patients = await db.patients.find({"id": {"$in": patient_ids}}, {"_id": 0}).to_list(1000)
    patient_map = {p["id"]: p for p in patients}
    
    # Group visits by type
    visits_by_type = {
        "nurse_visit": [],
        "vitals_only": [],
        "daily_note": []
    }
    
    for visit in visits:
        visit_type = visit.get("visit_type", "nurse_visit")
        visit["patient_name"] = patient_map.get(visit["patient_id"], {}).get("full_name", "Unknown")
        if visit_type in visits_by_type:
            visits_by_type[visit_type].append(visit)
        else:
            visits_by_type["nurse_visit"].append(visit)
    
    # Summary stats
    summary = {
        "period": f"{data.year}-{data.month:02d}",
        "start_date": start_date,
        "end_date": end_date,
        "total_visits": len(visits),
        "nurse_visits": len(visits_by_type["nurse_visit"]),
        "vitals_only": len(visits_by_type["vitals_only"]),
        "daily_notes": len(visits_by_type["daily_note"]),
        "unique_patients": len(patient_ids),
        "by_organization": {}
    }
    
    # Count by organization
    for visit in visits:
        org = visit.get("organization") or "Unspecified"
        summary["by_organization"][org] = summary["by_organization"].get(org, 0) + 1
    
    return {
        "summary": summary,
        "visits": visits,
        "visits_by_type": visits_by_type
    }

# ==================== DEMO DATA SETUP ====================
@api_router.get("/setup-demo-data")
async def setup_demo_data():
    """
    Creates demo data for testing after deployment.
    Call this endpoint once after deployment to populate test data.
    """
    try:
        # Check if data already exists
        existing_nurses = await db.nurses.count_documents({})
        if existing_nurses > 0:
            return {
                "message": "Demo data already exists",
                "nurses_count": existing_nurses,
                "status": "skipped"
            }
        
        # Create Organizations
        organizations = [
            {
                "id": str(uuid.uuid4()),
                "name": "POSH Host Homes",
                "address": "123 Main St, Seattle, WA 98101",
                "contact_person": "Jane Smith",
                "contact_phone": "(206) 555-0100"
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Ebenezer Private HomeCare",
                "address": "456 Oak Ave, Seattle, WA 98102",
                "contact_person": "John Davis",
                "contact_phone": "(206) 555-0200"
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Jericho",
                "address": "789 Pine St, Seattle, WA 98103",
                "contact_person": "Mary Wilson",
                "contact_phone": "(206) 555-0300"
            }
        ]
        
        for org in organizations:
            await db.organizations.insert_one(org)
        
        # Create Nurses
        nurses = [
            {
                "id": str(uuid.uuid4()),
                "email": "demo@nursemed.com",
                "password_hash": hash_password("demo123"),
                "full_name": "Demo Admin",
                "title": "Administrator",
                "license_number": "ADMIN001",
                "is_admin": True,
                "form_access": {
                    "nurse_visit": True,
                    "vitals_only": True,
                    "daily_note": True
                },
                "assigned_patients": [],
                "assigned_organizations": [org["id"] for org in organizations],
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "email": "sarah.johnson@nursemed.com",
                "password_hash": hash_password("nurse123"),
                "full_name": "Sarah Johnson",
                "title": "Registered Nurse (RN)",
                "license_number": "RN123456",
                "is_admin": False,
                "form_access": {
                    "nurse_visit": True,
                    "vitals_only": True,
                    "daily_note": True
                },
                "assigned_patients": [],
                "assigned_organizations": [organizations[0]["id"]],
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "email": "michael.chen@nursemed.com",
                "password_hash": hash_password("nurse123"),
                "full_name": "Michael Chen",
                "title": "Licensed Practical Nurse (LPN)",
                "license_number": "LPN789012",
                "is_admin": False,
                "form_access": {
                    "nurse_visit": False,
                    "vitals_only": True,
                    "daily_note": True
                },
                "assigned_patients": [],
                "assigned_organizations": [organizations[1]["id"]],
                "created_at": datetime.utcnow().isoformat()
            }
        ]
        
        for nurse in nurses:
            await db.nurses.insert_one(nurse)
        
        # Create Patients
        patients = [
            {
                "id": str(uuid.uuid4()),
                "full_name": "Margaret Williams",
                "permanent_info": {
                    "organization": organizations[0]["id"],
                    "gender": "Female",
                    "date_of_birth": "1945-03-15",
                    "living_situation": "host_home",
                    "home_address": "1234 Maple Drive, Seattle, WA 98104",
                    "caregiver_name": "Betty Williams (Daughter)",
                    "caregiver_phone": "(206) 555-1002",
                    "medications": ["Lisinopril 10mg daily", "Metformin 500mg twice daily", "Aspirin 81mg daily"],
                    "allergies": ["Penicillin", "Shellfish"],
                    "medical_diagnoses": ["Hypertension", "Type 2 Diabetes", "Osteoarthritis"],
                    "psychiatric_diagnoses": [],
                    "visit_frequency": "Monthly"
                },
                "nurse_id": nurses[1]["id"],
                "assigned_nurses": [nurses[1]["id"]],
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "full_name": "Robert Johnson",
                "permanent_info": {
                    "organization": organizations[1]["id"],
                    "gender": "Male",
                    "date_of_birth": "1938-07-22",
                    "living_situation": "private_home",
                    "home_address": "5678 Cedar Lane, Seattle, WA 98105",
                    "caregiver_name": "Linda Johnson (Wife)",
                    "caregiver_phone": "(206) 555-2002",
                    "medications": ["Furosemide 40mg daily", "Carvedilol 25mg twice daily", "Sertraline 50mg daily"],
                    "allergies": ["Latex"],
                    "medical_diagnoses": ["CHF", "COPD"],
                    "psychiatric_diagnoses": ["Depression"],
                    "visit_frequency": "Weekly"
                },
                "nurse_id": nurses[2]["id"],
                "assigned_nurses": [nurses[2]["id"]],
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "full_name": "Dorothy Martinez",
                "permanent_info": {
                    "organization": organizations[2]["id"],
                    "gender": "Female",
                    "date_of_birth": "1952-11-08",
                    "living_situation": "group_home",
                    "home_address": "9012 Birch Avenue, Seattle, WA 98106",
                    "caregiver_name": "Carlos Martinez (Son)",
                    "caregiver_phone": "(206) 555-3002",
                    "medications": ["Donepezil 10mg daily", "Amlodipine 5mg daily", "Memantine 10mg twice daily"],
                    "allergies": [],
                    "medical_diagnoses": ["Hypertension"],
                    "psychiatric_diagnoses": ["Alzheimer's Disease"],
                    "visit_frequency": "Bi-weekly"
                },
                "nurse_id": nurses[0]["id"],
                "assigned_nurses": [nurses[0]["id"]],
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
        ]
        
        for patient in patients:
            await db.patients.insert_one(patient)
        
        return {
            "message": "Demo data created successfully!",
            "organizations_created": len(organizations),
            "nurses_created": len(nurses),
            "patients_created": len(patients),
            "login_credentials": {
                "admin": "demo@nursemed.com / demo123",
                "nurses": [
                    "sarah.johnson@nursemed.com / nurse123",
                    "michael.chen@nursemed.com / nurse123"
                ]
            },
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== HEALTH CHECK ====================
@api_router.get("/")
async def root():
    return {"message": "POSH-Able Living API", "status": "healthy"}

# Include router and middleware
app.include_router(api_router)

# Health check endpoint for Kubernetes (must be at root, not under /api)
@app.get("/health")
async def health_check():
    """
    Kubernetes health check endpoint.
    Returns 200 OK if the application is running.
    """
    try:
        # Optionally check database connectivity
        await db.command('ping')
        return {
            "status": "healthy",
            "service": "POSH-Able Living API",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "POSH-Able Living API",
            "database": "disconnected",
            "error": str(e)
        }

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
