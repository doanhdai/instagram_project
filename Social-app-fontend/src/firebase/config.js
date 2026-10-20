import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyATII-v-m8HMnrefbI5FXH0CymncIf6FFc",
  authDomain: "chat-app-96016.firebaseapp.com",
  projectId: "chat-app-96016",
  storageBucket: "chat-app-96016.appspot.com",
  messagingSenderId: "149850723260",
  appId: "1:149850723260:web:b1c33898a7705c7da691b9",
  measurementId: "G-ET6HV8FFN8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };
