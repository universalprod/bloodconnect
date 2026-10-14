# BloodConnect

A responsive blood-donation website with donor registration, coordinator-only donor search, and blood request submissions. Donor and patient records are stored in Firebase Cloud Firestore. The existing visual design is retained, with a coordinator sign-in/search panel added to the community section.

## Run locally

This is a static site using native browser JavaScript modules; it does not need a build step or npm packages. In VS Code, the Live Server extension can serve the open folder (choose **Go Live**). Or, in PowerShell, open a terminal in the project folder and run:

```powershell
Set-Location "C:\blood donate"
py -m http.server 8000
```

If the Python launcher is unavailable but Python is installed, use `python -m http.server 8000`. Then open [http://localhost:8000](http://localhost:8000). A local HTTP server is needed because browsers may block JavaScript modules opened directly from a `file:` URL.

## Firebase setup

1. Create a project in the [Firebase console](https://console.firebase.google.com/), register a **Web app** in Project settings, and copy its web configuration.
2. Create a **Cloud Firestore** database in production mode. Publish this project's `firestore.rules` in **Firestore Database > Rules** before collecting submissions.
3. Enable **Authentication > Sign-in method > Email/Password**. Create coordinator accounts yourself in **Authentication > Users**; there is no public account-registration form.
4. For each coordinator, copy their Firebase Authentication **UID**. In Firestore, create a document at `coordinators/{UID}` with these fields:
   - `active` — boolean `true`
   - `role` — string `coordinator`

   Only a project administrator should create or change these documents. The rules allow a signed-in user to read only their own coordinator document, and clients cannot create, edit, list, or delete coordinator records.
5. Open `src/firebase-config.js` in VS Code. In Firebase Console, open **Project settings** (gear icon) > **General** > **Your apps** > your Web app > **SDK setup and configuration** > **Config**. Copy the four values into the existing object, replacing only the empty strings:

   ```js
   export const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     appId: "YOUR_WEB_APP_ID",
   };
   ```

   Leave the property names and quotes in place; use the exact values from your own Firebase console, not the example placeholders. These Firebase web-app settings identify the project; they are not server credentials. Security depends on Authentication and Firestore Rules, not on hiding the web config.
6. Add your site host to **Authentication > Settings > Authorized domains**. For a GitHub Pages site such as `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`, the host is `YOUR-USERNAME.github.io` (without the repository path).
7. If Firestore asks for a composite index for the blood-group/city search, open the index-creation link in the Firebase error message and create the suggested index.
8. Before public launch, configure Firebase App Check, restrict the Firebase API key to the required APIs and production domains, and establish a process for authorized staff to respond to and delete records. Do not use this form to collect medical records or details that are not needed for coordination.

### Access and privacy

- Anyone may submit a donor registration or blood request. Firestore rules validate the allowed fields and permit **create only**; public users cannot read, list, edit, or delete those submissions.
- Only signed-in accounts whose `coordinators/{UID}` document is active and has the coordinator role may search donors or read submitted requests. Donor searches match the selected blood group and a normalized city name, and return at most 50 results. The displayed contact method follows the donor's preference.
- Donor records created before `cityKey` was added will not appear in city searches. If you already have donor records, have an administrator backfill each `cityKey` using the same normalization (trim, remove combining accents, lowercase, and collapse whitespace), or ask donors to register again.
- Coordinator sign-in uses browser-session persistence. Sign out to clear donor results from the page. Do not use coordinator accounts on shared devices.
- Submissions are stored in Firestore; this starter does not send email/SMS notifications or include a coordinator dashboard for reviewing blood requests.
- Firebase configuration is blank by default. Forms display a setup error rather than claiming a submission or search succeeded when Firebase is not configured.
- Client-side validation improves usability; Firestore rules independently validate submission fields. Enable Firebase App Check and consider a trusted server-side anti-abuse/notification workflow before relying on anonymous form submissions in production.

### Test with sample data

Use made-up test details only; do not enter a real patient's information.

1. Save your Firebase configuration and run the site over HTTP as described above. Submit the donor form using a name such as `Sample Donor`, a test email/phone you control, blood group `O+`, city `Sample City`, and your preferred contact method.
2. Wait for the form's success message. It appears only after Firestore confirms the write. In Firebase Console > **Firestore Database > Data**, verify a new document appears in `donors` with `bloodGroup: "O+"` and `cityKey: "sample city"`. A setup/permission/network error is not a successful connection.
3. In Firebase Console > **Authentication > Users**, create a coordinator user. Copy the user's UID and add `coordinators/{UID}` in Firestore with boolean `active: true` and string `role: "coordinator"`. Make sure the `firestore.rules` from this project are published.
4. Sign in on the page with that coordinator account. The search panel appears only after the app successfully reads the coordinator's Firestore authorization document. Search for `O+` in `Sample City`; the sample registration should appear. If Firebase asks for a composite index, create it using the link in the error.
5. Submit a blood request using clearly fictional sample details and a future date. Wait for its success message, then verify a document appears in the `requests` collection in the Firebase console.
6. Test access restrictions: sign out and confirm the search UI is hidden. In Firestore Rules playground or the Emulator Suite, check that unauthenticated reads of `donors` and `requests` are denied and that updates/deletes of donor records are denied, including for coordinators. Do not weaken production rules to make a test pass.
7. Remove the sample documents in the Firebase console when finished. If using a real email/phone, use your own test contact and delete it afterwards.

The page does not display a generic “Firebase connected” badge. A donor/request success message follows a successful Firestore write, donor results follow a successful authorized query, and coordinator tools appear only after an authorized coordinator document is read. With blank config, those operations cannot run and the UI tells you what to configure.

This site is not an emergency service and does not determine donor eligibility or blood compatibility. For urgent needs, contact local emergency services and the hospital blood bank directly. Eligibility, matching, and transfusion decisions belong to qualified medical professionals.

## Deploy the frontend with GitHub Pages

1. Push the project files to a GitHub repository. Do not commit private service-account keys; this frontend only needs the Firebase web configuration.
2. In GitHub, open the repository **Settings > Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**, choose your deployment branch (usually `main`) and the repository root (`/`), then save.
4. Wait for the Pages deployment to finish. Open the published `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/` URL and check both forms and coordinator sign-in.
5. Add `YOUR-USERNAME.github.io` to Firebase Authentication's authorized domains and use your deployed domain when restricting the Firebase API key. Re-publish Firestore rules after any rule changes.

GitHub Pages only hosts the frontend; Firebase Authentication and Firestore remain hosted by Firebase. The web app configuration in `src/firebase-config.js` is part of the browser-delivered site. Protect access to donor/patient data with the published Firestore rules and coordinator authorization.

## Project files

- `index.html` — page content, navigation, donor/request forms, and coordinator search UI.
- `src/style.css` — responsive styling.
- `src/main.js` — navigation, validation feedback, form submissions, and coordinator UI.
- `src/validation.js` — donor, search, and request validation plus city normalization.
- `src/firebase.js` — Firebase initialization, session sign-in, submissions, and authorized donor search.
- `src/firebase-config.js` — Firebase web app configuration placeholder.
- `firestore.rules` — field validation, create-only public submissions, and coordinator-gated reads.
