// protected routes layout
"use client";
import { useAuth } from "@/utils/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Circles from "@/components/Circles";

export default function ProtectedLayout({ children }) {
    const { usr, role, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!usr || !role)) {
            router.push("/login");
        }
    }, [usr, role, loading, router]);

    if (loading || !usr || !role) {
        return <Circles />;
    }

    return <>{children}</>;
}
