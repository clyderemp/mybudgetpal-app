import { db, auth } from '../../../firebase.js'
import { doc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";
import { uid } from '../../../main.js';
import { convertFormattedDateBack, getFormattedTodayDate } from '../APIs/dateFormatters.js';

export const fetchAllTransactions = async() => {
    // localStorage.clear();
    let transactions = JSON.parse(await localStorage.getItem('transactionData-'+uid)) || [];
    const todayDate = await getFormattedTodayDate();// Find the earliest date in the transactions array
    const earliestDateTransaction = transactions.reduce((earliest, currentTransaction) => {
        const currentDate = new Date(currentTransaction.date);
        const earliestDate = new Date(earliest.date);
    
        return currentDate < earliestDate ? currentTransaction : earliest;
    });

    const startDateFilterVal = await localStorage.getItem('startDateFilter') || earliestDateTransaction?.date;
    const endDateFilterVal = await localStorage.getItem('endDateFilterVal') || todayDate;

    $('#start-date-filter').val(startDateFilterVal);
    $('#end-date-filter').val(endDateFilterVal);
    
    if(transactions === null || transactions?.length <= 0){
        console.log('Fetching transactions from firebase...');
        const collectionRef = collection(db, 'users', uid, 'transactions');
        const collectionSnap = await getDocs(collectionRef);
        if(!collectionSnap.empty){
            collectionSnap.forEach(doc => {
                transactions.push(doc.data());
            });
        }
        await localStorage.setItem('transactionData-'+uid, JSON.stringify(transactions));
    } else {
        console.log('Fetching transactions from local...');
    }

    var arr = [];
    for( var key in transactions){
        const transactionDate = await convertFormattedDateBack(transactions[key].date);
        const startDateFilterObj = await convertFormattedDateBack(startDateFilterVal);
        const endDateFilterObj = await convertFormattedDateBack(endDateFilterVal);
        // Check if the transaction's date is between the start and end filter dates
        if (transactionDate >= startDateFilterObj && transactionDate <= endDateFilterObj) {
            arr.push(transactions[key]);
        }
    }
    //SORTS THE RECENT FIRST
    arr.sort(function(a, b) {
        var keyA = new Date(a.date),
            keyB = new Date(b.date);
        // Compare the 2 dates
        if (keyA < keyB) return 1;
        if (keyA > keyB) return -1;
        return 0;
    });
    
    transactions = arr;
    // setFilterDates(transactions);
    return transactions;
}

async function analyzeTopExpenses(transactions){
}

