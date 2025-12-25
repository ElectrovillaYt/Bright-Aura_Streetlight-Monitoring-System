//Backend Endpoint for gateway requests
import { db } from "./utils/firebase.js";
import { Timestamp } from 'firebase-admin/firestore';

const docid_1 = "GeoData";
const docid_2 = "Complaint_Logs";

const Scheduler = async () => {
  const CurrentDate = Timestamp.now().toDate();

  const ComplaintDataRef = db.collection(docid_2).doc("complaints");
  const ComplaintDataSnap = await ComplaintDataRef.get();
  if (ComplaintDataSnap.exists) {
    let complaintData = ComplaintDataSnap.data();

    if (complaintData.complaints[0]) {
      //Data Change Flags
      let ComplaintDataChanged = false;
      let DataChangeDetected = false;

      complaintData.complaints = await Promise.all(
        (complaintData.complaints || []).map(async (c) => {
          const { Country, State, Place } = c.GeoData;
          const DataRef = db
            .collection(docid_1)
            .doc(`"${Country.toUpperCase()}"`)
            .collection(`"${State.toUpperCase()}"`)
            .doc(`"${Place.toUpperCase()}"`);
          const DataSnap = await DataRef.get();

          if (DataSnap.exists) {
            const GeoData = DataSnap.data();
            const ComplaintDate = c.createdAt.toDate();
            const Complaint_Timeout = Math.floor((CurrentDate - ComplaintDate) / (1000 * 60 * 60));

            if (c.status !== "rejected") { //comaplint is older then 1 day!
              GeoData.features = GeoData.features?.map((f) => {
                if (c.id === f.properties.id) {
                  if (c.status == "pending") {
                    if (c.properties.status === f.properties.status && Complaint_Timeout <= 24) {
                      c.status = "approved";
                      f.properties.statusPriority = "1";
                      ComplaintDataChanged = true;
                      DataChangeDetected = true;
                    }
                    else if (c.properties.status !== f.properties.status && Complaint_Timeout > 24) {
                      c.status = "rejected";
                      ComplaintDataChanged = true;
                    }
                  }
                  else if (c.status == "resolved") {
                    if (c.properties.status === f.properties.status) {
                      f.properties.statusPriority = "0";
                      f.properties.status = "1";
                      DataChangeDetected = true;
                    }
                  }
                }
                return f;
              });
            }
            else if (complaintData.complaints[0] && Complaint_Timeout / 24 > 30) { //1 mmonth passed cleanup old logs
              ComplaintDataChanged = true;
              return;
            }

            if (DataChangeDetected) {
              await DataRef.update(GeoData);
            }
          }
          return c;
        })
      );

      if (ComplaintDataChanged) {
        // Filter out nulls before updating Firestore
        complaintData.complaints = complaintData.complaints.filter(c => c != null);
        await ComplaintDataRef.update(complaintData);
      }
    }
  };
}
