import { db, auth } from '../../../firebase.js'
import { doc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";
import { uid } from '../../../main.js';
import { convertFormattedDateBack, getFormattedTodayDate, getStartOfMonth } from '../APIs/dateFormatters.js';
import { exchangeRates, selectedCurrencyCode } from '../APIs/currencyConverter.js';
import { selectedPrimaryUserVal } from '../../view/components/navbars/topbar.js';

export const fetchAllTransactions = async() => {
    // localStorage.clear();
    
    let transactions = await JSON.parse(await localStorage.getItem('transactionData-'+uid)) || [];

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

    const firstDayOfTheMonth = await getStartOfMonth();// Find the earliest date in the transactions array
    const todayDate = await getFormattedTodayDate();// Find the earliest date in the transactions array
    const earliestDateTransaction = transactions?.reduce((earliest, currentTransaction) => {
        const currentDate = new Date(currentTransaction.date);
        const earliestDate = new Date(earliest.date);
    
        return currentDate < earliestDate ? currentTransaction : earliest;
    });

    const startDateFilterVal = await localStorage.getItem('startDateFilter') || firstDayOfTheMonth;
    const endDateFilterVal = await localStorage.getItem('endDateFilterVal') || todayDate;

    $('#start-date-filter').val(startDateFilterVal);
    $('#end-date-filter').val(endDateFilterVal);

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
    
    const fullName = selectedPrimaryUserVal?.lname === 'All Users' ? '' : `${selectedPrimaryUserVal?.fname} ${selectedPrimaryUserVal?.lname}`;
    transactions = arr.filter((data)=>{ return data.reportedBy.includes(fullName)});

    await Promise.all(transactions.map(async (data, index) => {
        // Default conversion factor to 1 (i.e., no conversion)
        let conversionBasedOnCurrency;
    
        // If currency is the same as selectedCurrencyCode, no conversion needed
        if (data.currency === selectedCurrencyCode) {
            conversionBasedOnCurrency = 1;
        } else if (data.currency) {
            // If a currency is defined, convert from that currency to selectedCurrencyCode
            conversionBasedOnCurrency = exchangeRates[data.currency];
        } else {
            // If no currency is provided, assume it's in CAD and convert to selectedCurrencyCode
            conversionBasedOnCurrency = exchangeRates['CAD'];
        }
    
        // If exchange rate is valid, apply the conversion
        const convertedValue = parseFloat(data?.value) / conversionBasedOnCurrency;
    
        // Update the transaction with the converted value and currency
        transactions[index] = {
            ...transactions[index],
            value: parseFloat(convertedValue.toFixed(2)), // Ensuring 2 decimal places
            currency: data?.currency || 'CAD', // Default to CAD if no currency exists
        };
    }));
    
    return transactions;
}

async function analyzeTopExpenses(transactions){
}

