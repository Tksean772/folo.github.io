// Import the functions you need from the Firebase CDN (no npm needed for simple HTML)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAu88y6oZpBfd_3eYwOQUsaNWGcMQdvslw",
  authDomain: "folo-1852b.firebaseapp.com",
  projectId: "folo-1852b",
  storageBucket: "folo-1852b.firebasestorage.app",
  messagingSenderId: "310049348691",
  appId: "1:310049348691:web:935a0fef97a729d6bcfaa6",
  measurementId: "G-KPZLPE8ZSP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the tools so your other files can use them
export const auth = getAuth(app);
export const db = getFirestore(app, 'folo'); // Explicitly connect to the 'folo' database

