import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/utils/firebaseConfig";
import { NextResponse } from "next/server";
import admin from "@/utils/firebaseAdmin";
const docid_1 = "GeoData";
const docid_2 = "Complaint_Logs";

export async function POST(req) {
    try {
        const reqData = await req.json();
        let { Country, State, Place } = reqData?.GeoData;
        const geojson = reqData?.data;
        // return NextResponse.json(geojson, { status: 200 });
        if (!Country || !State || !Place || !geojson) {
            return NextResponse.json(
                { message: "Invalid Data!" },
                { status: 400 }
            );
        }
        const Geolocation = { Country, State, Place };
        Country = `"${Country.toUpperCase().trim()}"`;
        State = `"${State.toUpperCase().trim()}"`;
        Place = `"${Place.toUpperCase().trim()}"`;

        // Fetch GeoData document
        const docRef = doc(db, docid_1, Country, State, Place);
        const document = await getDoc(docRef);

        if (!document.exists()) {
            return NextResponse.json(
                { message: "Sorry no record found, Complaint Rejected!" },
                { status: 404 }
            );
        }
        const geodata = document.data(); //data from firestore

        // Formatting incoming data..
        geojson.GeoData = Geolocation;
        geojson.createdAt = admin.firestore.Timestamp.now().toDate();

        // Incoming data - Streetlight ID and status
        const id = geojson.properties?.id;
        const status = geojson.properties?.status;

        // Format incoming data
        geojson.properties = {
            location: geojson.properties.location,
            status: geojson.properties.status,
        };

        let ID_Exist = false;

        geodata.features = geodata.features.map((f) => {
            if (f.properties?.id === id) {
                ID_Exist = true;
            }
            return f;
        });

        // Streetlight with given ID not found!
        if (!ID_Exist) {
            return NextResponse.json(
                {
                    message:
                        "Sorry, Streetlight Isn't Registered!!, Complaint Rejected",
                },
                { status: 404 }
            );
        }

        // Fetch complaints data from doc
        const ComplaintdocRef = doc(db, docid_2, "complaints");
        const document2 = await getDoc(ComplaintdocRef);

        //first complaint received!
        if (document2.exists()) {
            const complaintData = document2.data();
            if (complaintData.complaints?.length == 0) {
                if (status != 1) {
                    const newComplaint = {
                        complaints: [{ id, status: "pending", ...geojson }],
                    };
                    setDoc(ComplaintdocRef, newComplaint);
                } else {
                    return NextResponse.json(
                        { message: "No Complaints to be registered!" },
                        { status: 200 }
                    );
                }
            } else {
                let NewComplaintReceieved = false;
                let Streetlight_status = 0;
                complaintData.complaints = complaintData.complaints.filter(
                    (c) => {
                        if (c?.id === id) {
                            Streetlight_status = c.properties.status;
                            c.properties.status = status;
                            return status != 1;
                        }
                        NewComplaintReceieved = true;
                        return c;
                    }
                );

                if (NewComplaintReceieved) {
                    complaintData.complaints?.push(...geodata.features);
                    updateDoc(ComplaintdocRef, complaintData);
                }
                if (Streetlight_status != status) {
                    updateDoc(ComplaintdocRef, complaintData);
                    if (status == 1) {
                        return NextResponse.json(
                            { message: "Complaint Revoked!" },
                            { status: 200 }
                        );
                    }
                } else {
                    return NextResponse.json(
                        {
                            message:
                                "Complaint already registered, PLease wait for few days!",
                        },
                        { status: 400 }
                    );
                }
            }
            return NextResponse.json(
                {
                    message:
                        "Complaint registration succesfull, Held for review!",
                },
                { status: 200 }
            );
        }
    } catch (error) {
        return NextResponse.json(
            { message: error?.message || "Invalid Data!" },
            { status: 400 }
        );
    }
}
