import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/utils/firebaseConfig";
import { NextResponse } from "next/server";
const key = "0612";
const docId = "DataAudit_logs";

export async function POST(req) {
    const reqKey = req.headers.get("key");
    try {
        if (reqKey == key) {
            const logData = await req.json();
            const uid = logData.uid;
            if (!uid) {
                return NextResponse.json(
                    { message: "UID is required" },
                    { status: 400 }
                );
            }
            const docRef = doc(db, docId, `${logData.role}s`, String(uid));
            const document = await getDoc(docRef);
            const Data = {
                role: logData.role,
                lampId: logData.lampId,
                coordinates: logData.coordinates,
                timestamp: logData.timestamp,
            };
            if (document.exists()) {
                // Previous logs exist in DB
                let logs = document.data();
                let auditArray = logs?.logs || [];
                auditArray.push(Data);
                await setDoc(docRef, { logs: auditArray });
                return NextResponse.json(
                    { message: "Audit logs updated" },
                    { status: 200 }
                );
            } else {
                // New log entry with new UID
                await setDoc(docRef, { logs: [Data] });
                return NextResponse.json(
                    { message: "New audit log created" },
                    { status: 201 }
                );
            }
        }
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
