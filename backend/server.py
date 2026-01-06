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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'nurse-visit-secret-key-2024')
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
    home_address: Optional[str] = None
    # Adult Day Program
    attends_adult_day_program: Optional[bool] = False
    adult_day_program_name: Optional[str] = None
    adult_day_program_address: Optional[str] = None
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

class PhysicalAssessment(BaseModel):
    general_appearance: Optional[str] = None
    general_appearance_from_last: Optional[bool] = False  # Pull from last visit
    skin_assessment: Optional[str] = None
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
    normal: Optional[bool] = False
    glasses: Optional[bool] = False
    contacts: Optional[bool] = False
    cataracts: Optional[bool] = False
    glaucoma: Optional[bool] = False
    blind: Optional[bool] = False
    blind_which: Optional[str] = None  # 'left', 'right', 'both'
    other: Optional[bool] = False
    other_notes: Optional[str] = None

class EarsHearingAssessment(BaseModel):
    normal: Optional[bool] = False
    hearing_aid: Optional[bool] = False
    hard_of_hearing: Optional[bool] = False
    deaf: Optional[bool] = False
    ear_infection: Optional[bool] = False
    other: Optional[bool] = False
    other_notes: Optional[str] = None

class MouthOralAssessment(BaseModel):
    normal: Optional[bool] = False
    dentures: Optional[bool] = False
    dentures_upper: Optional[bool] = False
    dentures_lower: Optional[bool] = False
    dentures_partial: Optional[bool] = False
    dentures_full: Optional[bool] = False
    poor_dentition: Optional[bool] = False
    mouth_sores: Optional[bool] = False
    dry_mouth: Optional[bool] = False
    other: Optional[bool] = False
    other_notes: Optional[str] = None

class HeadToToeAssessment(BaseModel):
    head_neck: Optional[str] = None
    head_neck_from_last: Optional[bool] = False
    eyes_vision: Optional[Union[str, EyesVisionAssessment]] = None
    eyes_vision_from_last: Optional[bool] = False
    ears_hearing: Optional[Union[str, EarsHearingAssessment]] = None
    ears_hearing_from_last: Optional[bool] = False
    nose_nasal_cavity: Optional[str] = None
    nose_nasal_cavity_from_last: Optional[bool] = False
    mouth_teeth_oral_cavity: Optional[Union[str, MouthOralAssessment]] = None
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

class HomeVisitLogbook(BaseModel):
    locked_meds_checked: Optional[bool] = False
    mar_reviewed: Optional[bool] = False
    bm_log_checked: Optional[bool] = False
    communication_log_checked: Optional[bool] = False
    seizure_log_checked: Optional[bool] = False
    notes: Optional[str] = None

class VisitCreate(BaseModel):
    visit_date: Optional[str] = None
    visit_type: str = "nurse_visit"  # nurse_visit, vitals_only, daily_note
    organization: Optional[str] = None  # POSH-Able Living, Ebenezer Private Home Care
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
    organization: Optional[str] = None
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
    attempt_location: str  # home, day_program, telephone, virtual, other
    attempt_location_other: Optional[str] = None
    spoke_with_anyone: Optional[bool] = False
    spoke_with_whom: Optional[str] = None
    individual_location: str  # admitted, moved_temporarily, moved_permanently, vacation, deceased, other
    individual_location_other: Optional[str] = None
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
    attempt_location: str
    attempt_location_other: Optional[str] = None
    spoke_with_anyone: Optional[bool] = False
    spoke_with_whom: Optional[str] = None
    individual_location: str
    individual_location_other: Optional[str] = None
    facility_name: Optional[str] = None
    facility_city: Optional[str] = None
    facility_state: Optional[str] = None
    admission_date: Optional[str] = None
    admission_reason: Optional[str] = None
    expected_return_date: Optional[str] = None
    additional_info: Optional[str] = None
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
    await db.patients.insert_one(patient_doc)
    
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
            {"_id": 0, "id": 1, "visit_date": 1, "vital_signs": 1},
            sort=[("visit_date", -1)]
        )
        
        # Get last UTC record (sorted by created_at for precise ordering)
        last_utc = await db.unable_to_contact.find_one(
            {"patient_id": p["id"]},
            {"_id": 0, "id": 1, "attempt_date": 1, "individual_location": 1, "individual_location_other": 1},
            sort=[("created_at", -1)]
        )
        
        p["last_visit_id"] = last_visit.get("id") if last_visit else None
        p["last_visit_date"] = last_visit.get("visit_date") if last_visit else None
        p["last_vitals_date"] = last_visit.get("visit_date") if last_visit else None
        
        # Include UTC regardless of date (show most recent UTC)
        if last_utc:
            location_map = {
                "admitted": "Hospitalized",
                "moved_temporarily": "Temp Move",
                "moved_permanently": "Perm Move",
                "vacation": "Vacation",
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
    patient = await db.patients.find_one({"id": patient_id, "nurse_id": nurse["id"]})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    visit_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    visit_date = data.visit_date or now
    
    visit_doc = {
        "id": visit_id,
        "patient_id": patient_id,
        "nurse_id": nurse["id"],
        "visit_date": visit_date,
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
        "screening_completed_by": data.screening_completed_by,
        "reviewed_and_signed_by": data.reviewed_and_signed_by,
        "created_at": now
    }
    await db.visits.insert_one(visit_doc)
    
    # Update patient's last_vitals
    await db.patients.update_one(
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
        organization=data.organization,
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
    patient = await db.patients.find_one({"id": patient_id, "nurse_id": nurse["id"]})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    visits = await db.visits.find({"patient_id": patient_id}, {"_id": 0}).sort("visit_date", -1).to_list(1000)
    return [VisitResponse(**v) for v in visits]

@api_router.get("/visits/{visit_id}", response_model=VisitResponse)
async def get_visit(visit_id: str, nurse: dict = Depends(get_current_nurse)):
    visit = await db.visits.find_one({"id": visit_id, "nurse_id": nurse["id"]}, {"_id": 0})
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
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
    # Verify patient exists and belongs to nurse
    patient = await db.patients.find_one({"id": data.patient_id, "nurse_id": nurse["id"]})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    record_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    record_doc = {
        "id": record_id,
        "patient_id": data.patient_id,
        "nurse_id": nurse["id"],
        "visit_type": data.visit_type,
        "attempt_date": data.attempt_date,
        "attempt_time": data.attempt_time,
        "attempt_location": data.attempt_location,
        "attempt_location_other": data.attempt_location_other,
        "spoke_with_anyone": data.spoke_with_anyone,
        "spoke_with_whom": data.spoke_with_whom,
        "individual_location": data.individual_location,
        "individual_location_other": data.individual_location_other,
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
        attempt_location=data.attempt_location,
        attempt_location_other=data.attempt_location_other,
        spoke_with_anyone=data.spoke_with_anyone,
        spoke_with_whom=data.spoke_with_whom,
        individual_location=data.individual_location,
        individual_location_other=data.individual_location_other,
        expected_return_date=data.expected_return_date,
        admission_date=data.admission_date,
        admission_reason=data.admission_reason,
        additional_info=data.additional_info,
        created_at=now
    )

@api_router.get("/patients/{patient_id}/unable-to-contact", response_model=List[UnableToContactResponse])
async def list_unable_to_contact(patient_id: str, nurse: dict = Depends(get_current_nurse)):
    patient = await db.patients.find_one({"id": patient_id, "nurse_id": nurse["id"]})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
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
    
    record["patient"] = {"full_name": patient.get("full_name", "Unknown")}
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
    # Verify patient exists and belongs to nurse
    patient = await db.patients.find_one({"id": data.patient_id, "nurse_id": nurse["id"]})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    intervention_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    intervention_doc = {
        "id": intervention_id,
        "patient_id": data.patient_id,
        "nurse_id": nurse["id"],
        "intervention_date": data.intervention_date,
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
    patient = await db.patients.find_one({"id": patient_id, "nurse_id": nurse["id"]})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
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

# ==================== HEALTH CHECK ====================
@api_router.get("/")
async def root():
    return {"message": "POSH-Able Living API", "status": "healthy"}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
