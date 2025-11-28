// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCSsW3erFb2hxk7HaPvUAlbCuL_5iUsonQ",
  authDomain: "invbuenaries.firebaseapp.com",
  projectId: "invbuenaries",
  storageBucket: "invbuenaries.firebasestorage.app",
  messagingSenderId: "799814446590",
  appId: "1:799814446590:web:6c2e431e7ba799026224af"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);