import express from 'express';
import admin from 'firebase-admin'; // Using firebase@9
import moment from 'moment';
import dotenv from 'dotenv';
import path from 'path';
import { getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './config/config.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { log } from 'console';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



dotenv.config();
const app = express();
const port = process.env.PORT || 8000;

// Initialize Firebase Admin SDK with service account credentials (replace with your actual values)
admin.initializeApp({
  credential: admin.credential.cert({
    "type": process.env.TYPE,
    "project_id": process.env.PROJECT_ID,
    "private_key_id": process.env.PRIVATE_KEY_ID,
    "private_key": process.env.PRIVATE_KEY,
    "client_email": process.env.CLIENT_EMAIL,
    "client_id": process.env.CLIENT_ID,
    "auth_uri": process.env.AUTH_URI,
    "token_uri": process.env.TOKEN_URI,
    "auth_provider_x509_cert_url": process.env.AUTH_PROVIDER_X509_CERT_URL,
    "client_x509_cert_url": process.env.CLIENT_X509_CERT_URL,
    "universe_domain": process.env.UNIVERSE_DOMAIN
  }),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});

const firestore = admin.firestore();

// Daily update task (using async/await)
async function updateInterestAmounts() {
  const batch = firestore.batch();
  const usersRef = firestore.collection('users');
  const usersSnapshot = await usersRef.get();
  try {


    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const investedAmount = userData.investedAmount || 0;
      const currentInterestAmount = userData.interestAmount || 0;
      const currentWithdrawableAmount = userData.withdrawableAmount || 0;
      const referralAmount = userData.referralAmount || 0;
      let totalReferralAddition = 0;

      const referralUsersArray = userData.referralUsers || [];
      for (const referralUser of referralUsersArray) {
        const referralUserDoc = await firestore.collection('users').doc(referralUser).get();
        const referralUserDocData = referralUserDoc.data();
        const referralUserInvestedAmount = referralUserDocData.investedAmount || 0;
        totalReferralAddition += referralUserInvestedAmount * 0.003;

        const childOfChildReferralUsersArray = referralUserDocData.referralUsers || [];
        for (const childOfChildReferralUser of childOfChildReferralUsersArray) {
          const childOfChildreferralUserDoc = await firestore.collection('users').doc(childOfChildReferralUser).get();
          const childOfChildreferralUserDocData = childOfChildreferralUserDoc.data();
          const childOfChildreferralUserInvestedAmount = childOfChildreferralUserDocData.investedAmount || 0;
          totalReferralAddition += childOfChildreferralUserInvestedAmount * 0.002;

          const childOfChildOfChildReferralUsersArray = childOfChildreferralUserDocData.referralUsers || [];
          for (const childOfChildOfChildReferralUser of childOfChildOfChildReferralUsersArray) {
            const childOfChildOfChildreferralUserDoc = await firestore.collection('users').doc(childOfChildOfChildReferralUser).get();
            const childOfChildOfChildreferralUserDocData = childOfChildOfChildreferralUserDoc.data();
            const childOfChildOfChildreferralUserInvestedAmount = childOfChildOfChildreferralUserDocData.investedAmount || 0;
            totalReferralAddition += childOfChildOfChildreferralUserInvestedAmount * 0.001;

          }
        }

      }

      const interestUpdate = investedAmount * 0.0012;
      const newInterestAmount = currentInterestAmount + interestUpdate;
      const newReferralAmount = referralAmount + totalReferralAddition;
      const newWithdrawableAmount = currentWithdrawableAmount + interestUpdate + totalReferralAddition;

      batch.set(doc.ref, {
        interestAmount: newInterestAmount,
        withdrawableAmount: newWithdrawableAmount,
        referralAmount: newReferralAmount,
      }, { merge: true });
    }

    await batch.commit();
    console.log('Interest amounts updated successfully!');
  } catch (error) {
    console.error('Error updating interest amounts:', error);
  }
}

async function updateInvestedAmount() {
  try {
    const usersSnapshot = await firestore.collection('users').get();

    // Iterate through each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const { investedAmount, investmentTransactions } = userData;

      let updatedInvestedAmount = investedAmount;
      let updatedTransactionsArray = investmentTransactions;

      // Iterate through each investment transaction
      const userRef1 = await doc(db,'users',userId);
      const userDoc1 = await getDoc(userRef1);
      const user1 = userDoc1.data();
      console.log("user", user1);
      for (const transactionId of updatedTransactionsArray) {
        // Fetch transaction data from paymentApprovalRequests collection
        console.log("transaction Id --- ",transactionId)
        console.log("user Id --- ",userId)
        const transactionRef = await doc(db, 'paymentApprovalRequests', transactionId);
        console.log("recieved transaction ref");
        const transactionDoc = await getDoc(transactionRef);
        console.log("recieved transaction doc");
        const transaction = await transactionDoc.data();
        console.log("recieved transaction data");
        // Check if the transaction is older than 1 year
        const transactionDate = moment(transaction.date.toDate());
        console.log("transactionDate --- ");
        const oneYearAgo = moment().subtract(1, 'day');
        if (transactionDate.isBefore(oneYearAgo) && transaction.status==='acccepted') {
          console.log("Entered to update----");
          // Subtract the transaction amount from the invested amount
          updatedInvestedAmount -= transaction.amount;
          // Update the user document in Firestore
        }
        const userRef = await doc(db,'users',userId);
          const userDoc = await getDoc(userRef);
          const user = userDoc.data();
          console.log("user", user);
      }
    }

    console.log('InvestedAmount updated successfully');
  } catch (error) {
    console.error('Error updating investedAmount:', error);
  }
}

app.use(express.json());
// Start the server with Nodemon for automatic restarts during development
app.listen(port, () => console.log(`Server listening on port ${port}`));

await updateInterestAmounts();
// await updateInvestedAmount();