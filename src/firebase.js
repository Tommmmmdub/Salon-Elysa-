import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyALkQfGiiWcn23kftDvE__Ev2e2KhCAtDY",
  authDomain: "elysa-dashboard.firebaseapp.com",
  projectId: "elysa-dashboard",
  storageBucket: "elysa-dashboard.firebasestorage.app",
  messagingSenderId: "779433952307",
  appId: "1:779433952307:web:39ec1662e31c2a85d1cf46"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
