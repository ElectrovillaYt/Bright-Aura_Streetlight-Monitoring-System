// procted- user dashboard page
"use client";
import React, { useEffect } from "react";
import MAP from "@/components/map";
import { useRouter } from "next/navigation";
import { useAuth } from "@/utils/AuthContext";
import Navbar from "@/components/Header";

const Dashboard = () => {
    const { usr, role } = useAuth();
    const router = useRouter();
    // redirect user back to login if invalid credentials
    useEffect(() => {
        if (!usr || !role) router.back();
    }, [usr, role, router]);
    return (
        <div className="w-screen h-screen flex flex-col">
            {/* navbar components with protected navigation routes */}
            <Navbar showHamburger={true} />
            <div className="grow relative">
                {/*actual Map compnent */}
                <MAP />
            </div>
        </div>
    );
};

export default Dashboard;
