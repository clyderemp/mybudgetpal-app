import { coUsersDataVal } from "../../model/coUsersData.js";
import { currentUserDataVal } from "../../model/currentUserData.js";
import { capitalEachFirstLetter } from "./textFormatters.js";

export let allUserReporters = [];
export const categories = ['income', 'savings', 'expenses', 'credit'];
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
export async function launchInvoiceForm(){
    await loadCategories();
    await loadUserReporters();
}

async function loadCategories(){
    categories?.forEach(async (category) => {
        const html = `<option value="${category}">${await capitalEachFirstLetter(category)}</option>`;
        $('#invoiceForm-category').append(html);
    });

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