import { uid } from "../../../main.js";
import { coUsersDataVal } from "../../model/coUsersData.js";
import { currentUserDataVal } from "../../model/currentUserData.js";
import { saveDocument } from "../services/saveDocument.js";
import { currentExchangeRateVal } from "./currencyConverter.js";
import { generateTransactionID } from "./IDGenerators.js";
import { capitalEachFirstLetter } from "./textFormatters.js";

export let allUserReporters = [];
export const categories = ['income', 'savings', 'expenses', 'credit'];
export const paymentMethod = ['Debit Account', 'Cash Payment', 'Credit Card', 'Cheque Payment', 'Short-Term Savings'];
export const types = {
    expenses: [
        //FIXED EXPENSES
        "Car Payments",
        "Credit Payments",
        "Insurance",
        "Internet Bill",
        "Loan Payments",
        "Memberships",
        "Phone Bill",
        "Rent",
        "Subscriptions",
        "Taxes",
        "Tuition",
        "Utilities",
        //VARIABLE EXPENSES
        "Appliances",
        "Car Maintenance",
        "Charge Fees",
        "Clothings",
        "Commute",
        "Dining Out",
        "Entertainment",
        "E-Purchases",
        "Gas",
        "Groceries",
        "Home Maintenance",
        "Investments",
        "Medical Care",
        "Others (Personal Spendings)",
        "Parking",
        "Recreation",
        "Taxes",
        "Travels",
        "Personal Care"
    ],
    credit: [
        'Personal Loan',
        'Credit Card',
        'Student Loan',
        'Auto Loan'
    ],
    savings: [
        'Short Term Savings',
        'Long Term Savings',
        'Emergency Funds',
        'Retirement Savings',
        'Investment Savings'
    ],
    income: [
        'Job Paycheque',
        'Tax Return',
        'Passive Income',
        'Loan Funds',
        'Others'
    ]
}
export let transactionID = null;
export async function launchInvoiceForm(){
    transactionID = await generateTransactionID();
    await loadCategories();
    await loadUserReporters();
    await loadPaymentMethods();
}

async function loadCategories(){
    $('#invoiceForm-category').empty();
    categories?.forEach(async (category) => {
        const html = `<option value="${category}">${await capitalEachFirstLetter(category)}</option>`;
        $('#invoiceForm-category').append(html);
    });

    await loadCategoryType(categories[0]);

    $('#invoiceForm-category').change(async function(){
        $('#invoiceForm-type').empty();
        await loadCategoryType(this.value);
    })
}

async function loadCategoryType(category){
    let html = ``;
    const categoryType = types[category];
    categoryType?.forEach(async (type)=>{
        html += `<option value="${type}">${await capitalEachFirstLetter(type)}</option>`;
        $('#invoiceForm-type').append(html);
    });
}

async function loadUserReporters(){
    const fullName = currentUserDataVal?.fname +' '+currentUserDataVal?.lname;
    const html = `<option value="${fullName}">${fullName}</option>`;
    $('#invoiceForm-reporter').append(html);
    coUsersDataVal?.forEach(coUser => {

        const fname = coUser?.fname;
        const lname = coUser?.lname;
        const fullName = fname+' '+lname;
        allUserReporters.push(fullName);
        const html = `<option value="${fullName}">${fullName}</option>`;
        $('#invoiceForm-reporter').append(html);
    });
}

async function loadPaymentMethods(){
    $('#invoiceForm-paymentMethod').empty();
    paymentMethod?.forEach(method => {
        const html = `<option value="${method}">${method}</option>`;
        $('#invoiceForm-paymentMethod').append(html);
    });
}

export async function submitInvoiceForm(){
    console.log('here')
}

$('#invoiceForm').on('submit', async function(event){
    event.preventDefault();
    const recipient = $('#invoiceForm-paidToFrom').val();
    const date = $('#invoiceForm-date').val();
    const amount = ($('#invoiceForm-amount').val()) / currentExchangeRateVal;
    const category = $('#invoiceForm-category').val();
    const type = $('#invoiceForm-type').val();
    const paymentMethod = $('#invoiceForm-paymentMethod').val();
    const reporter = $('#invoiceForm-reporter').val();
    const note = $('#invoiceForm-note').val();
    const creation_date = new Date();
    const docData = {
        item_id: transactionID,
        transaction: recipient,
        note: note,
        date: date,
        category: category,
        type: type,
        value: amount,
        reportedBy: reporter,
        paymentMethod: paymentMethod,
        creation_date: creation_date,
        exchange_rate: currentExchangeRateVal? currentExchangeRateVal : 1,
    };
    
    const collectionPath = `users/${uid}/transactions`;
    const documentPath = transactionID;
    const success = await saveDocument(collectionPath, documentPath, docData);
    
    if(success){
        Alert.alert('Success!', 'Your invoice has been saved!');
    }
})