import { firebaseConfig } from "./firebase-config.js";
import { normalizeCity } from "./validation.js";

const FIREBASE_SDK_VERSION = "10.14.1";
const MAX_SEARCH_RESULTS = 50;
let firebaseClientsPromise;

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

async function getFirebaseClients() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add your web app settings first.");
  }

  if (!firebaseClientsPromise) {
    firebaseClientsPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`),
    ])
      .then(([appSdk, authSdk, firestoreSdk]) => {
        const app = appSdk.getApps().length > 0
          ? appSdk.getApps()[0]
          : appSdk.initializeApp(firebaseConfig);
        return {
          auth: authSdk.getAuth(app),
          authSdk,
          db: firestoreSdk.getFirestore(app),
          firestoreSdk,
        };
      })
      .catch((error) => {
        firebaseClientsPromise = undefined;
        throw error;
      });
  }

  return firebaseClientsPromise;
}

export async function saveSubmission(collectionName, data) {
  if (!["donors", "requests"].includes(collectionName)) {
    throw new Error("Unsupported submission type.");
  }
  const { db, firestoreSdk } = await getFirebaseClients();
  await firestoreSdk.addDoc(firestoreSdk.collection(db, collectionName), {
    ...data,
    createdAt: firestoreSdk.serverTimestamp(),
  });
}

export async function signInCoordinator(email, password) {
  const { auth, authSdk } = await getFirebaseClients();
  await authSdk.setPersistence(auth, authSdk.browserSessionPersistence);
  return authSdk.signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOutCoordinator() {
  const { auth, authSdk } = await getFirebaseClients();
  await authSdk.signOut(auth);
}

export async function watchCoordinatorSession(onSession, onError) {
  const { auth, authSdk, db, firestoreSdk } = await getFirebaseClients();
  let stopCoordinatorWatch = () => {};
  return authSdk.onAuthStateChanged(
    auth,
    (user) => {
      stopCoordinatorWatch();
      stopCoordinatorWatch = () => {};
      if (!user) {
        onSession(null);
        return;
      }

      stopCoordinatorWatch = firestoreSdk.onSnapshot(
        firestoreSdk.doc(db, "coordinators", user.uid),
        async (profile) => {
          if (profile.exists() && profile.data().active === true && profile.data().role === "coordinator") {
            onSession(user);
            return;
          }
          stopCoordinatorWatch();
          stopCoordinatorWatch = () => {};
          try {
            await authSdk.signOut(auth);
            onError(new Error("This account is not authorized for coordinator access."));
          } catch (error) {
            onError(error);
          }
        },
        onError,
      );
    },
    onError,
  );
}

export async function searchDonors(bloodGroup, city) {
  const { auth, db, authSdk, firestoreSdk } = await getFirebaseClients();
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in with an authorized coordinator account to search donors.");

  const profile = await firestoreSdk.getDoc(
    firestoreSdk.doc(db, "coordinators", user.uid),
  );
  if (!profile.exists() || profile.data().active !== true || profile.data().role !== "coordinator") {
    throw new Error("This account is not authorized for coordinator access.");
  }

  const donorsQuery = firestoreSdk.query(
    firestoreSdk.collection(db, "donors"),
    firestoreSdk.where("bloodGroup", "==", bloodGroup),
    firestoreSdk.where("cityKey", "==", normalizeCity(city)),
    firestoreSdk.limit(MAX_SEARCH_RESULTS),
  );
  const results = await firestoreSdk.getDocs(donorsQuery);
  return results.docs.map((donorDocument) => {
    const donor = donorDocument.data();
    const contactByEmail = donor.contactPreference === "email";
    return {
      fullName: donor.fullName,
      bloodGroup: donor.bloodGroup,
      city: donor.city,
      contactLabel: contactByEmail ? "Email" : "Phone",
      contactValue: contactByEmail ? donor.email : donor.phone,
    };
  });
}
