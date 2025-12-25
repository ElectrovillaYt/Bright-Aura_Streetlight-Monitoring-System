import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/utils/firebaseConfig";
import { NextResponse } from "next/server";

const docId = "GeoData";
const key = "0986"; //Assigned random key to secure the req

export async function GET(req) {
    try {
        const AuthKey = await req.headers.get("key");
        const DataHeader = await req.headers.get("data");
        if (AuthKey == key) {
            if (!DataHeader)
                return NextResponse.json(
                    { message: "Invalid Request Data!" },
                    { status: 400 }
                );
            const { Country, State, Place } = JSON.parse(DataHeader);
            const country = String(Country).toUpperCase();
            const StateName = String(State || Country).toUpperCase();
            const PlaceName = String(Place || Country).toUpperCase();
            const docRef = doc(db, docId, `"${country}"`, `"${StateName}"`, `"${PlaceName}"`);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists() || !docSnap.data()) {
                return NextResponse.json({
                    message:
                        "No street lights are currently installed in this area!",
                }, { status: 204 });
            }
            return NextResponse.json(docSnap.data(), { status: 200 });
        }
        return NextResponse.json({ message: "Invalid Auth Key!" }, { status: 403 });
    } catch (error) {
        return NextResponse.json(
            { message: error.message },
            { status: 500 }
        );
    }
}

export async function POST(req) {
    //Getting Post req From FrontEnd
    const AuthKey = req.headers.get("key");
    const reqHeader = await req.headers.get("data");
    try {
        if (AuthKey == key) {
            if (!reqHeader)
                return NextResponse.json(
                    { message: "Invalid Request header!" },
                    { status: 400 }
                );
            const reqData = await req.json();
            let { Country, State, Place } = JSON.parse(reqHeader);
            if (!Country || !State || !Place)
                return NextResponse.json(
                    { message: "Inavlid Location Data!!" },
                    { status: 400 }
                );
            Country = Country.toUpperCase().trim();
            State = State.toUpperCase().trim();
            Place = Place.toUpperCase().trim();
            const geojson = await reqData.data;
            const docRef = doc(
                db,
                docId,
                `"${Country}"`,
                `"${State}"`,
                `"${Place}"`
            );
            const document = await getDoc(docRef);
            let geodata = document.exists();
            if (geojson != null) {
                if (geodata) {
                    geodata = document.data();
                    const id = geojson?.properties?.id;
                    const status = geojson?.properties?.status;
                    let Added = true;
                    let IsResolved = false;
                    let changeDetected = false;
                    geodata.features = geodata.features.map((f) => {
                        if (f.properties?.id === id) {
                            if (f.properties.status !== status) {
                                f.properties.status = status;
                                // if (f.properties.status = !status && status == '1') IsResolved = true; // functionlity due ahead
                                changeDetected = true;
                            }
                            Added = false;
                        }
                        return f;
                    });

                    if (Added) {
                        // Add New Streetlight in location
                        geodata.features.push(geojson);
                        await setDoc(docRef, geodata);
                        return NextResponse.json(
                            { message: "New Data Added!" },
                            { status: 201 }
                        );
                    } else {
                        // Update exisiting streetlight state in chain
                        if (changeDetected) {
                            await updateDoc(docRef, geodata);
                            return NextResponse.json(
                                { message: "Data Updated!" },
                                { status: 202 }
                            );
                        }
                        return NextResponse.json(
                            { message: "ID already exists!" },
                            { status: 200 }
                        );
                    }
                } else {
                    // New Location
                    const features = [geojson];
                    const initJson = { type: "FeatureCollection", features };
                    await setDoc(docRef, initJson);
                    return NextResponse.json(
                        { message: "Initial Data Added!" },
                        { status: 201 }
                    );
                }
            }
            return NextResponse.json(
                { message: "Null Value Received!!" },
                { status: 400 }
            );
        }
        return NextResponse.json({ message: "Invalid Auth Key!" }, { status: 403 });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
