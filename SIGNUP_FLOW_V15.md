# Sign-up flow fix (v15)

## Problem
Sign-up showed "No categories available" and never offered business types (e.g. Dentist / Dental Surgeon).
- Categories came ONLY from the Firestore document `app_config/categories` (admin-edited). Empty/missing -> empty dropdown.
- Business types were looked up by turning the admin's category *name* into a key ("Medical & Healthcare" -> "medical-&-healthcare"), which never matched the built-in list.
- After sign-up the server still sent everybody through role selection again, and the GPS button never saved coordinates (members could not appear in radius search).

## Fix
- Category dropdown is always populated: admin list (labels/order) mapped to built-in categories + any built-in category missing from it.
- Business types always appear after choosing a category; required for every business role (message example: Dentist / Dental Surgeon).
- New type **Dentist / Dental Surgeon** (Medical & Healthcare -> services dashboard). Dental Clinic stays on the health dashboard.
- The role chosen on the form is no longer silently overwritten by the business type.
- Server (`/api/profile/bootstrap`) validates the chosen type against the catalogue and derives category, type name and dashboard layout itself; browser text is never trusted.
- Members who already chose role + type at sign-up go straight to the matching dashboard after login (no second role screen). Google sign-ups, which have not chosen yet, still get Role -> Business type.
- GPS coordinates are saved at sign-up (validated, 0 allowed) so the business shows up in nearby/radius search.
- Added missing labels for Real Estate and Home & Garden categories.

## Dashboard mapping
Doctor, Dentist, Therapist, other individual services -> Services dashboard. Clinic, Hospital, Pharmacy, Dental Clinic -> Health dashboard. Automotive types -> Automotive dashboard. Everything else -> Business dashboard. Buyers -> Buyer dashboard.
