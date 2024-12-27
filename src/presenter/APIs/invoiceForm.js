import { uid } from "../../../main.js";
import { coUsersDataVal } from "../../model/coUsersData.js";
import { currentUserDataVal } from "../../model/currentUserData.js";
import { selectedPrimaryUserVal } from "../../view/components/navbars/topbar.js";
import { saveDocument, updateDocument } from "../services/saveDocument.js";
import { currentExchangeRateVal, exchangeRates, selectedCurrencyCode } from "./currencyConverter.js";
import { generateTransactionID } from "./IDGenerators.js";
import { launchSuccessModal } from "./sweetAlertModals.js";
import { capitalEachFirstLetter } from "./textFormatters.js";

export let allUserReporters = [];
export const categories = ['income', 'savings', 'expenses', 'credit'];
export const paymentMethod = {'debit':'Debit Account', 'cash':'Cash Payment', 'credit':'Credit Card', 'cheque':'Cheque Payment', 'savings':'Short-Term Savings'};
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
        "Dining Out - Food",
        "Dining Out - Drinks",
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
        "Personal Care",
        "Gym Related",
        "Vitamins & Supplements",
        "Unknown"
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
let editForm = false;
let editFormData = null;

export async function launchInvoiceForm(isEdit, data, showBackBtn){
    editForm = isEdit;
    if(showBackBtn){
        $('#invoice-back-btn').show();
        $('#invoice-close-btn').hide();
    } else {
        $('#invoice-back-btn').hide();
        $('#invoice-close-btn').show();
    }

    //HANDLE THE FORM DATA
    if(isEdit){
        transactionID = data?.item_id;
        editFormData = data;
        await loadCategories();
        await loadUserReporters();
        await loadPaymentMethods();
        await loadExistingDataOntoTheForm(data);
    } else {
        transactionID = await generateTransactionID();
        await loadCategories();
        await loadUserReporters();
        await loadPaymentMethods();
    }


    // Handle category change event
    $('#invoiceForm-category').off('change').on('change', async function() {
        // console.log('Category changed');
        await loadCategoryType(this.value);
    });

    //Back button
    $('#invoice-back-btn').click(async ()=>{
        await loadInvoiceTable();
    });

}

async function loadCategories(){
    $('#invoiceForm-category').empty();
   await categories?.forEach(async (category) => {
        const html = `<option value="${category}">${await capitalEachFirstLetter(category)}</option>`;
        $('#invoiceForm-category').append(html);
    });

    if(editForm){
        await loadCategoryType(editFormData?.category);
    } else {
        await loadCategoryType(categories[0]);
    }
}

async function loadCategoryType(category){
    let html = ``;
    const categoryType = types[category];
    $('#invoiceForm-type').html(html);
    categoryType?.forEach(async (type)=>{
        html = `<option value="${type}">${await capitalEachFirstLetter(type)}</option>`;

        $('#invoiceForm-type').append(html);
    });
    
    if(editForm){
        $('#invoiceForm-type').val(editFormData.type);
    }
}

async function loadUserReporters(){
    $('#invoiceForm-reporter').empty();
    const fullName = currentUserDataVal?.fname +' '+currentUserDataVal?.lname;
    const html = `<option value="${fullName}">${fullName}</option>`;
    $('#invoiceForm-reporter').append(html);
    await coUsersDataVal?.forEach(coUser => {

        const fname = coUser?.fname;
        const lname = coUser?.lname;
        const fullName = fname+' '+lname;
        allUserReporters.push(fullName);
        const html = `<option value="${fullName}">${fullName}</option>`;
        $('#invoiceForm-reporter').append(html);
    });

    const selected = selectedPrimaryUserVal?.lname === 'All Users' ? fullName : `${selectedPrimaryUserVal?.fname} ${selectedPrimaryUserVal?.lname}`;
    $('#invoiceForm-reporter').val(selected)
}

async function loadPaymentMethods(){
    $('#invoiceForm-paymentMethod').empty();
    await Object.entries(paymentMethod).forEach(([key, method]) => {
        const html = `<option value="${key}">${method}</option>`;
        $('#invoiceForm-paymentMethod').append(html);
    });
}

async function loadExistingDataOntoTheForm(data){
    //Load data into variables first
    // const conversionBasedOnCurrency = data.currency ===  selectedCurrencyCode ? 1 : data.currency !== undefined ? exchangeRates[data.currency] : exchangeRates['CAD'];
    const recipient = data?.transaction;
    const date = data?.date;
    const amount = (data?.value).toFixed(2);
    const category = data?.category;
    const type = data?.type;
    const paymentMethod = data?.paymentMethod;
    const reporter = (data?.reportedBy)?.replaceAll('Me - ','');
    const note = data?.note;

    //Load onto the form
    $('#invoiceForm-paidToFrom').val(recipient);
    $('#invoiceForm-paidToFrom').addClass('success');
    $('#invoiceForm-date').val(date);
    $('#invoiceForm-amount').val(amount);
    $('#invoiceForm-category').val(category);
    $('#invoiceForm-category').trigger('change');
    $('#invoiceForm-type').val(type) //Not working but oh well
    $('#invoiceForm-paymentMethod').val(paymentMethod);
    $('#invoiceForm-reporter').val(reporter);
    $('#invoiceForm-note').val(note);
}

async function loadInvoiceTable(){
    $('#invoiceTableModal').modal('show');
    $('#invoiceForm').modal('hide');
}


$('#invoiceForm').on('submit', async function(event){
    event.preventDefault();
    const recipient = $('#invoiceForm-paidToFrom').val();
    const date = $('#invoiceForm-date').val();
    const amount = ($('#invoiceForm-amount').val());
    const category = $('#invoiceForm-category').val();
    const type = $('#invoiceForm-type').val();
    const paymentMethod = $('#invoiceForm-paymentMethod').val();
    const reporter = $('#invoiceForm-reporter').val();
    const note = $('#invoiceForm-note').val();
    const creation_date = editForm ? editFormData?.creation_date : new Date();
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
        exchange_rate: currentExchangeRateVal,
        currency: selectedCurrencyCode,
    };
    
    const collectionPath = `users/${uid}/transactions`;
    const documentPath = transactionID;
    let success = false;
    if(editForm){
        success = await updateDocument(collectionPath, documentPath, docData);
    } else {
        success = await saveDocument(collectionPath, documentPath, docData);
    }
    
    if(success){
        await launchSuccessModal('Changes', 'Your invoice has been saved!');
        localStorage.removeItem('transactionData-'+uid);
        window.location.reload();
    }
})