"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Usrauth } from "./firebaseConfig";
import { VerifyRole } from "./firebaseUtils";
import { useRouter } from "next/navigation";
// AuthProvider component that wraps the application
const AuthContext = createContext();
export const AuthProvider = ({ children }) => {
    const [usr, setUsr] = useState(null);
    const [role, setRole] = useState(null); ``
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const getRole = useCallback((currUsrRole) => {
        sessionStorage.setItem("role", currUsrRole);
    }, []);

    useEffect(() => {
        try {
            const unsubscribe = onAuthStateChanged(Usrauth, async (user) => {
                if (user) {
                    const cachedRole = sessionStorage.getItem("role");
                    const userData = await VerifyRole(user.uid, cachedRole);
                    if (userData?.state) {
                        const idToken = await user.getIdToken();
                        const response = await fetch("/api/session-login", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ idToken }),
                        });
                        await response.json();
                        if (response.ok) {
                            setUsr(user);
                            setRole(userData.role);
                            router.push("/dashboard");
                        } else {
                            setUsr(null);
                            setRole(null);
                        }
                    }
                } else {
                    setUsr(null);
                    setRole(null);
                }
                setLoading(false);
            });
            return unsubscribe;
        } catch (error) {
          //  console.error("Error in auth state change:", error); //debug
            setLoading(false);
            setUsr(null);
            setRole(null);
        }
    }, [role]);

    return (
        <AuthContext.Provider value={{ usr, getRole, role, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;
