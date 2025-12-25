// protected- edit-map page to update-register the streetlight status in map via QR code scan
"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/library"; // Importing the ZXing library for QR code scanning
import Navbar from "@/components/Header";
import { QrCode, ScanQrCode } from "lucide-react";
import { useAuth } from "@/utils/AuthContext";
import { useAlert } from "@/utils/AlertProvider";

const QRScanner = () => {
    const { usr, role } = useAuth();
    const { showAlert } = useAlert();
    const [data, setData] = useState(null);
    const [GeoData, setGeoData] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [lightState, setLightState] = useState("1"); //default working
    const [scanState, setScanState] = useState("");
    const videoRef = useRef(null);

    const validatedata = (data) => {
        try {
            const parsedData = JSON.parse(data);
            if (parsedData.id) {
                return {
                    id: parsedData.id,
                };
            }
            throw new Error("Invalid QR Code Data");
        } catch (err) {
            showAlert(err?.message ?? err, "error");
            return null;
        }
    };

    const fetchCity = async (latitude, longitude) => {
        const API_KEY = process.env.NEXT_PUBLIC_Geoapify_Key;
        const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${API_KEY}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.features.length > 0) {
                return data.features[0];
            }
            throw new Error("City not found!");
        } catch (err) {
            return null;
        }
    };

    const fetchLocation = () => {
        return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => resolve(position.coords),
                    () => reject("Location permission denied or unavailable")
                );
            } else {
                reject("Geolocation is not supported by this browser");
            }
        });
    };

    const handleScanResult = useCallback(
        async (result) => {
            if (result) {
                setScanning(false);
                setScanState("Scanning... Please wait!");
                const validatedData = validatedata(result.getText());
                if (validatedData?.id) {
                    try {
                        const location = await fetchLocation();
                        const CityData = await fetchCity(
                            location?.latitude,
                            location?.longitude
                        );
                        if (location && CityData) {
                            const Country = CityData?.properties?.country || CityData?.properties?.continent;
                            const State = CityData?.properties?.state || CityData.properties?.country || CityData?.properties?.continent;
                            const cityName = CityData?.properties?.city || CityData.properties?.country || CityData?.properties?.continent;
                            setGeoData({
                                Country: Country,
                                State: State,
                                Place: cityName,
                            });
                            const finalData = {
                                geometry: {
                                    type: "Point",
                                    coordinates: [
                                        location.latitude,
                                        location.longitude,
                                    ],
                                },
                                properties: {
                                    id: validatedData.id,
                                    location: cityName,
                                },
                            };
                            setData(finalData);
                            showAlert("Scan Successful!", "info", 2500);
                            setScanning(false);
                        } else {
                            throw new Error("Failed to fetch city information");
                        }
                    } catch (error) {
                        showAlert(error?.message ?? error, "error");
                    } finally {
                        setScanState("");
                    }
                }
            }
        },
        [lightState]
    );

    useEffect(() => {
        const codeReader = new BrowserMultiFormatReader();
        if (scanning && videoRef.current) {
            codeReader.decodeFromVideoDevice(
                null,
                videoRef.current,
                handleScanResult
            );
        }
        return () => codeReader.reset();
    }, [scanning, handleScanResult]);

    const sendData = async () => {
        try {
            if (data) {
                const FinalDataJson = {
                    data: {
                        ...data,
                    },
                };
                FinalDataJson.data.properties.status = lightState;
                const auditState = await AuditLogger();
                if (auditState) {
                    const response = await fetch("/api/data", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            key: "0986",
                            data: JSON.stringify(GeoData),
                        },
                        body: JSON.stringify(FinalDataJson),
                    });
                    if (response.ok) {
                        showAlert("Data Updated Successfully!", "success");
                        setData(null);
                    } else {
                        throw new Error("Failed to submit data!");
                    }
                }
            }

        } catch (error) {
            showAlert("Error: ", error?.message ?? error, "error");
        }
    };

    const AuditLogger = async () => {
        try {
            const uid = await usr?.uid;
            const logData = {
                uid: uid,
                role: role,
                lampId: data.properties.id,
                lampStatus: lightState,
                coordinates: data.geometry.coordinates,
                timestamp: new Date().toISOString(),
            };
            const response = await fetch("/api/audit-log", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    key: "0612",
                },
                body: JSON.stringify(logData),
            });
            if (response.ok) return true;
            else return false;
        } catch (error) {
            return false;
        }
    };

    const handleUpdate = (e) => {
        e.preventDefault();
        sendData();
    };
    return (
        <>
            <Navbar
                showHamburger={false}
                isPublic={false}
                isLoginRequired={true}
            />
            <main className="container mx-auto p-4 flex flex-col items-center relative">
                <div className="relative flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-white/5 rounded-2xl shadow-xl p-6 relative">
                        {/* Start Screen */}
                        {!scanning && !data && (
                            <div className="flex flex-col items-center text-center">
                                <div className="border-4 border-dashed border-gray-300 rounded-xl p-8 mb-6">
                                    <QrCode
                                        size={120}
                                        className="text-gray-300"
                                    />
                                </div>
                                <p className="text-gray-300 mb-6">
                                    Scan the QR code on the light to
                                    register/audit the light details.
                                </p>
                                <button
                                    onClick={() => setScanning(true)}
                                    className="px-6 py-3 rounded-lg bg-(--color-primary)/80 hover:bg-(--color-primary) text-white font-medium flex items-center gap-2 transition"
                                >
                                    <ScanQrCode size={20} /> Start Scanning
                                </button>
                            </div>
                        )}

                        {/* Scanning Screen */}
                        {scanning && (
                            <div className="flex flex-col items-center">
                                <div className="scanner-container relative w-full max-w-md aspect-square rounded-lg overflow-hidden border-4 border-blue-500">
                                    <video
                                        ref={videoRef}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="scan-line absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-blue-500 to-transparent animate-scan"></div>
                                </div>
                                <p className="text-blue-400 mt-4 flex items-center gap-2 animate-pulse">
                                    <span className="w-3 h-3 bg-blue-400 rounded-full animate-ping"></span>
                                    {scanState}
                                </p>
                                <button
                                    onClick={() => { setScanning(false); setData(null); }}
                                    className="mt-4 px-4 py-2 rounded-lg border border-gray-500 text-gray-300 hover:bg-gray-700"
                                >
                                    Cancel Scan
                                </button>
                            </div>
                        )}

                        {/* QR Data Screen */}
                        {data && (
                            <div className="space-y-4">
                                <h3 className="text-white text-lg font-semibold">
                                    Streetlight Details
                                </h3>
                                <div className="bg-gray-700 p-4 rounded-lg space-y-2 text-gray-300">
                                    <p>
                                        Light ID:{" "}
                                        <span className="font-medium">
                                            {data.properties.id}
                                        </span>
                                    </p>
                                    <p>
                                        <span className="font-medium">
                                            Street Light Location:
                                        </span>{" "}
                                        {GeoData.Place +
                                            ", " +
                                            GeoData.State +
                                            ", " +
                                            GeoData.Country +
                                            "..."}
                                    </p>
                                </div>

                                <div>
                                    <label className="block font-medium text-gray-200 mb-2">
                                        Issue Type
                                    </label>
                                    <div className="flex gap-4">
                                        {[
                                            {
                                                label: "Working Light",
                                                value: "1",
                                            },
                                            {
                                                label: "Faulty Light",
                                                value: "0",
                                            },
                                        ].map((opt, index) => (
                                            <label
                                                key={opt.value}
                                                className={`flex-1 p-3 border rounded-lg cursor-pointer text-center transition ${lightState === opt.value
                                                    ? index === 1
                                                        ? "bg-red-500 text-white hover:bg-red-600"
                                                        : "bg-green-500 text-white hover:bg-green-600"
                                                    : "bg-gray-600 text-gray-300 hover:bg-gray-700"
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="status"
                                                    value={opt.value}
                                                    checked={
                                                        lightState === opt.value
                                                    }
                                                    onChange={() =>
                                                        setLightState(opt.value)
                                                    }
                                                    className="hidden"
                                                />
                                                {opt.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-between gap-2">
                                    <button
                                        onClick={() => setData(null)}
                                        className="px-4 py-2 border border-gray-500 rounded-lg text-gray-300 hover:bg-gray-700"
                                    >
                                        Rescan
                                    </button>
                                    <button
                                        onClick={(e) => handleUpdate(e)}
                                        className="px-6 py-2 bg-(--color-primary)/80 hover:bg-(--color-primary) text-white rounded-lg"
                                    >
                                        Submit
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
};

export default QRScanner;
