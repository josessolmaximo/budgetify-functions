/* eslint-disable max-len */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {v4} from "uuid";

admin.initializeApp();

const db = admin.firestore();

export const deleteUserCollection = functions.https.onCall( async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "The function must be called while authenticated."
    );
  }

  const userId = data.userId;

  if (!userId) {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "The function must be called while authenticated."
    );
  }

  const transactionRef = db.collection("users").doc(userId).collection("transactions");
  const walletRef = db.collection("users").doc(userId).collection("wallets");
  const budgetRef = db.collection("users").doc(userId).collection("budgets");
  const categoryRef = db.collection("users").doc(userId).collection("categories");
  const shortcutRef = db.collection("users").doc(userId).collection("shortcuts");
  const recurringRef = db.collection("users").doc(userId).collection("recurring");
  const sharingRef = db.collection("users").doc(userId).collection("sharing");

  await db.recursiveDelete(transactionRef);
  await db.recursiveDelete(walletRef);
  await db.recursiveDelete(budgetRef);
  await db.recursiveDelete(categoryRef);
  await db.recursiveDelete(shortcutRef);
  await db.recursiveDelete(recurringRef);
  await db.recursiveDelete(sharingRef);

  functions.logger.log(`Erased data of user ${userId}`);
});

export const deleteUserData = functions.auth.user().onDelete( async (user) => {
  const docRef = db.collection("users").doc(user.uid);

  await db.recursiveDelete(docRef);
});

export const sendInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "The function must be called while authenticated."
    );
  }

  const user = await admin.auth().getUserByEmail(data.recipientEmail);

  await db.collection("invites").doc(data.inviteId)
      .set({
        "id": data.inviteId,
        "originEmail": data.originEmail,
        "originId": data.originId,
        "recipientId": user.uid,
        "status": "Pending",
      }, {merge: true});
});

export const createAccess = functions.firestore
    .document("invites/{inviteId}")
    .onUpdate(async (change, context) => {
      const newValue = change.after.data();
      if (newValue.status === "Accepted") {
        const recipientUser = await admin.auth().getUser(newValue.recipientId);
        const originUser = await admin.auth().getUser(newValue.originId);
        const id = v4().toUpperCase();

        db.collection(`users/${newValue.originId}/sharing`).doc(recipientUser.uid)
            .set({
              "id": id,
              "permissions": {
                "create": true,
                "read": true,
                "update": true,
                "delete": true,
              },
              "originUser": {
                "id": originUser.uid,
                "email": originUser.email,
                "displayName": originUser.displayName ?? "Unnamed User",
                "photoURL": originUser.photoURL ?? "",
              },
              "recipientUser": {
                "id": recipientUser.uid,
                "email": recipientUser.email,
                "displayName": recipientUser.displayName ?? "Unnamed User",
                "photoURL": recipientUser.photoURL ?? "",
              },
            }, {merge: true});
      }

      change.after.ref.delete();
    });
