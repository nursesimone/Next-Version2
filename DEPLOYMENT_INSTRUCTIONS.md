# 🚀 Deployment Instructions

## Step 1: Deploy Your App
1. Click the **"Deploy"** button in the Emergent chat
2. Wait 10-15 minutes for deployment to complete
3. You'll receive a permanent URL (e.g., `https://yourapp.preview.emergentagent.com`)

## Step 2: Set Up Demo Data (ONE-TIME ONLY)

After deployment, your database will be empty. To load test data:

### Option A: Use Browser (Easy!)
1. Open your deployed app URL in browser
2. Add `/api/setup-demo-data` to the URL
3. Example: `https://yourapp.preview.emergentagent.com/api/setup-demo-data`
4. You'll see a success message with the number of items created

### Option B: Use cURL (if you prefer terminal)
```bash
curl -X POST https://yourapp.preview.emergentagent.com/api/setup-demo-data
```

## Step 3: Login with Test Credentials

After setup completes, you can login with:

**Admin Account (Full Access):**
- Email: `demo@nursemed.com`
- Password: `demo123`

**Test Nurse Accounts:**
- Email: `sarah.johnson@nursemed.com` | Password: `nurse123`
- Email: `michael.chen@nursemed.com` | Password: `nurse123`

## Step 4: What You'll Have

### ✅ 3 Organizations:
- POSH Host Homes
- Ebenezer Private HomeCare
- Jericho

### ✅ 3 Test Patients:
- Margaret Williams (80 yrs, Female, POSH Host Homes)
- Robert Johnson (87 yrs, Male, Ebenezer)
- Dorothy Martinez (73 yrs, Female, Jericho)

### ✅ 3 Staff Members:
- Demo Admin (Administrator - access to all)
- Sarah Johnson (RN - POSH Host Homes)
- Michael Chen (LPN - Ebenezer)

## ⚠️ Important Notes

1. **Run setup ONLY ONCE** - Running it multiple times is safe (it checks if data exists)
2. **Making Changes** - After making changes in chat:
   - Click "Deploy" again to update your live app
   - Then refresh your browser to see changes
3. **Fresh Start** - If you want to reset data, you can run the setup endpoint again (it skips if data exists)

## 🎉 You're Ready!

Once setup is complete:
- Login and test all features
- Create new visits, daily notes
- Test the draft functionality
- Generate reports
- Explore the admin panel

**Have fun testing your app!** 🚀
