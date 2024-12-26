
import { auth, db } from '../../../js/firebase.js';
import {currencyCodes} from '../js/dataFile.js'
import { uid } from './main.js';
import { getDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";

const currencyDropdown = $('#currencyDropdown');
export var exchange_rate = null;
export var currency = null;

$(async function(){

    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    const docData = docSnap?.data();
    exchange_rate = docData?.exchange_rate;
    currency = exchange_rate?.code;
    exchange_rate = exchange_rate?.value;
    setCurrencySymbolValue(currency);

    for(var currency in currencyCodes){
        var html = '<option value="'+currencyCodes[currency]+'" class="flag-icon flag-icon-us">'+currencyCodes[currency]+'</option>'
        currencyDropdown.append(html);
    }

    currencyDropdown.change(async function(){
        var selected_currency = this.value;
        localStorage.setItem('currencyCode', selected_currency);
        convert_CAD_to_SelectedCurrency(selected_currency);
        setCurrencySymbolValue(selected_currency);
        // const rate = rates[selected_currency];
        // console.log(rate)
    });

    // if((currencyDropdown.val()===null || currencyDropdown.val() === undefined) && localStorage.getItem('currencyCode') === null){
    //     // Call the function to get the local currency
    //     //getLocalCurrency();
    //     currencyDropdown.val('CAD');
    //     localStorage.setItem('currencyCode', 'CAD');
    //     convert_CAD_to_SelectedCurrency('CAD');
    //     setCurrencySymbolValue('CAD')
    // }

    // if(localStorage.getItem('currencyCode') != null || currencyDropdown.val() == ""){
    //     currencyDropdown.val(localStorage.getItem('currencyCode'))
    //     localStorage.setItem('currencyCode', currencyDropdown.val());
    //     convert_CAD_to_SelectedCurrency(currencyDropdown.val());
    //     setCurrencySymbolValue(currencyDropdown.val());
    // }

});

export function getLocalCurrency() {
    // Fetch the user's IP address
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
        const ipAddress = data.ip;

        // Call the GeoIP API to get location details based on the IP address
        fetch(`http://ip-api.com/json/${ipAddress}`)
            .then(response => response.json())
            .then(data => {

            // Extract the country name from the response
            const country = data.country;

            // You may need to map the country to its corresponding currency
            // For simplicity, let's assume it's USD for the US, EUR for EU countries, and GBP for UK
            let countryCode;
            switch (country) {
                case "United Arab Emirates":
                    countryCode = "AED";
                    break;
                case "Afghanistan":
                    countryCode = "AFN";
                    break;
                case "Albania":
                    countryCode = "ALL";
                    break;
                case "Armenia":
                    countryCode = "AMD";
                    break;
                case "Netherlands Antilles":
                    countryCode = "ANG";
                    break;
                case "Angola":
                    countryCode = "AOA";
                    break;
                case "Argentina":
                    countryCode = "ARS";
                    break;
                case "Australia":
                    countryCode = "AUD";
                    break;
                case "Aruba":
                    countryCode = "AWG";
                    break;
                case "Azerbaijan":
                    countryCode = "AZN";
                    break;
                case "Bosnia and Herzegovina":
                    countryCode = "BAM";
                    break;
                case "Barbados":
                    countryCode = "BBD";
                    break;
                case "Bangladesh":
                    countryCode = "BDT";
                    break;
                case "Bulgaria":
                    countryCode = "BGN";
                    break;
                case "Bahrain":
                    countryCode = "BHD";
                    break;
                case "Burundi":
                    countryCode = "BIF";
                    break;
                case "Bermuda":
                    countryCode = "BMD";
                    break;
                case "Brunei":
                    countryCode = "BND";
                    break;
                case "Bolivia":
                    countryCode = "BOB";
                    break;
                case "Brazil":
                    countryCode = "BRL";
                    break;
                case "Bahamas":
                    countryCode = "BSD";
                    break;
                case "Bhutan":
                    countryCode = "BTN";
                    break;
                case "Botswana":
                    countryCode = "BWP";
                    break;
                case "Belarus":
                    countryCode = "BYN";
                    break;
                case "Belize":
                    countryCode = "BZD";
                    break;
                case "Canada":
                    countryCode = "CAD";
                    break;
                case "Congo":
                    countryCode = "CDF";
                    break;
                case "Switzerland":
                    countryCode = "CHF";
                    break;
                case "Chile":
                    countryCode = "CLP";
                    break;
                case "China":
                    countryCode = "CNY";
                    break;
                case "Colombia":
                    countryCode = "COP";
                    break;
                case "Costa Rica":
                    countryCode = "CRC";
                    break;
                case "Cuba":
                    countryCode = "CUP";
                    break;
                case "Cape Verde":
                    countryCode = "CVE";
                    break;
                case "Czech Republic":
                    countryCode = "CZK";
                    break;
                case "Djibouti":
                    countryCode = "DJF";
                    break;
                case "Denmark":
                    countryCode = "DKK";
                    break;
                case "Dominican Republic":
                    countryCode = "DOP";
                    break;
                case "Algeria":
                    countryCode = "DZD";
                    break;
                case "Egypt":
                    countryCode = "EGP";
                    break;
                case "Eritrea":
                    countryCode = "ERN";
                    break;
                case "Ethiopia":
                    countryCode = "ETB";
                    break;
                case "European Union":
                    countryCode = "EUR";
                    break;
                case "Fiji":
                    countryCode = "FJD";
                    break;
                case "Falkland Islands":
                    countryCode = "FKP";
                    break;
                case "Faroe Islands":
                    countryCode = "FOK";
                    break;
                case "United Kingdom":
                    countryCode = "GBP";
                    break;
                case "Georgia":
                    countryCode = "GEL";
                    break;
                case "Guernsey":
                    countryCode = "GGP";
                    break;
                case "Ghana":
                    countryCode = "GHS";
                    break;
                case "Gibraltar":
                    countryCode = "GIP";
                    break;
                case "Gambia":
                    countryCode = "GMD";
                    break;
                case "Guinea":
                    countryCode = "GNF";
                    break;
                case "Guatemala":
                    countryCode = "GTQ";
                    break;
                case "Guyana":
                    countryCode = "GYD";
                    break;
                case "Hong Kong":
                    countryCode = "HKD";
                    break;
                case "Honduras":
                    countryCode = "HNL";
                    break;
                case "Croatia":
                    countryCode = "HRK";
                    break;
                case "Haiti":
                    countryCode = "HTG";
                    break;
                case "Hungary":
                    countryCode = "HUF";
                    break;
                case "Indonesia":
                    countryCode = "IDR";
                    break;
                case "Israel":
                    countryCode = "ILS";
                    break;
                case "Isle of Man":
                    countryCode = "IMP";
                    break;
                case "India":
                    countryCode = "INR";
                    break;
                case "Iraq":
                    countryCode = "IQD";
                    break;
                case "Iran":
                    countryCode = "IRR";
                    break;
                case "Iceland":
                    countryCode = "ISK";
                    break;
                case "Jersey":
                    countryCode = "JEP";
                    break;
                case "Jamaica":
                    countryCode = "JMD";
                    break;
                case "Jordan":
                    countryCode = "JOD";
                    break;
                case "Japan":
                    countryCode = "JPY";
                    break;
                case "Kenya":
                    countryCode = "KES";
                    break;
                case "Kyrgyzstan":
                    countryCode = "KGS";
                    break;
                case "Cambodia":
                    countryCode = "KHR";
                    break;
                case "Kiribati":
                    countryCode = "KID";
                    break;
                case "Comoros":
                    countryCode = "KMF";
                    break;
                case "North Korea":
                    countryCode = "KPW";
                    break;
                case "South Korea":
                    countryCode = "KRW";
                    break;
                case "Kuwait":
                    countryCode = "KWD";
                    break;
                case "Cayman Islands":
                    countryCode = "KYD";
                    break;
                case "Kazakhstan":
                    countryCode = "KZT";
                    break;
                case "Laos":
                    countryCode = "LAK";
                    break;
                case "Lebanon":
                    countryCode = "LBP";
                    break;
                case "Sri Lanka":
                    countryCode = "LKR";
                    break;
                case "Liberia":
                    countryCode = "LRD";
                    break;
                case "Lesotho":
                    countryCode = "LSL";
                    break;
                case "Libya":
                    countryCode = "LYD";
                    break;
                case "Morocco":
                    countryCode = "MAD";
                    break;
                case "Moldova":
                    countryCode = "MDL";
                    break;
                case "Madagascar":
                    countryCode = "MGA";
                    break;
                case "North Macedonia":
                    countryCode = "MKD";
                    break;
                case "Myanmar":
                    countryCode = "MMK";
                    break;
                case "Mongolia":
                    countryCode = "MNT";
                    break;
                case "Macau":
                    countryCode = "MOP";
                    break;
                case "Mauritania":
                    countryCode = "MRU";
                    break;
                case "Mauritius":
                    countryCode = "MUR";
                    break;
                case "Maldives":
                    countryCode = "MVR";
                    break;
                case "Malawi":
                    countryCode = "MWK";
                    break;
                case "Mexico":
                    countryCode = "MXN";
                    break;
                case "Malaysia":
                    countryCode = "MYR";
                    break;
                case "Mozambique":
                    countryCode = "MZN";
                    break;
                case "Namibia":
                    countryCode = "NAD";
                    break;
                case "Nigeria":
                    countryCode = "NGN";
                    break;
                case "Nicaragua":
                    countryCode = "NIO";
                    break;
                case "Norway":
                    countryCode = "NOK";
                    break;
                case "Nepal":
                    countryCode = "NPR";
                    break;
                case "New Zealand":
                    countryCode = "NZD";
                    break;
                case "Oman":
                    countryCode = "OMR";
                    break;
                case "Panama":
                    countryCode = "PAB";
                    break;
                case "Peru":
                    countryCode = "PEN";
                    break;
                case "Papua New Guinea":
                    countryCode = "PGK";
                    break;
                case "Philippines":
                    countryCode = "PHP";
                    break;
                case "Pakistan":
                    countryCode = "PKR";
                    break;
                case "Poland":
                    countryCode = "PLN";
                    break;
                case "Paraguay":
                    countryCode = "PYG";
                    break;
                case "Qatar":
                    countryCode = "QAR";
                    break;
                case "Romania":
                    countryCode = "RON";
                    break;
                case "Serbia":
                    countryCode = "RSD";
                    break;
                case "Russia":
                    countryCode = "RUB";
                    break;
                case "Rwanda":
                    countryCode = "RWF";
                    break;
                case "Saudi Arabia":
                    countryCode = "SAR";
                    break;
                case "Solomon Islands":
                    countryCode = "SBD";
                    break;
                case "Seychelles":
                    countryCode = "SCR";
                    break;
                case "Sudan":
                    countryCode = "SDG";
                    break;
                case "Sweden":
                    countryCode = "SEK";
                    break;
                case "Singapore":
                    countryCode = "SGD";
                    break;
                case "Saint Helena":
                    countryCode = "SHP";
                    break;
                case "Sierra Leone":
                    countryCode = "SLL";
                    break;
                case "Somalia":
                    countryCode = "SOS";
                    break;
                case "Suriname":
                    countryCode = "SRD";
                    break;
                case "South Sudan":
                    countryCode = "SSP";
                    break;
                case "São Tomé and Príncipe":
                    countryCode = "STN";
                    break;
                case "Syria":
                    countryCode = "SYP";
                    break;
                case "Eswatini":
                    countryCode = "SZL";
                    break;
                case "Thailand":
                    countryCode = "THB";
                    break;
                case "Tajikistan":
                    countryCode = "TJS";
                    break;
                case "Turkmenistan":
                    countryCode = "TMT";
                    break;
                case "Tunisia":
                    countryCode = "TND";
                    break;
                case "Tonga":
                    countryCode = "TOP";
                    break;
                case "Turkey":
                    countryCode = "TRY";
                    break;
                case "Trinidad and Tobago":
                    countryCode = "TTD";
                    break;
                case "Tuvalu":
                    countryCode = "TVD";
                    break;
                case "Taiwan":
                    countryCode = "TWD";
                    break;
                case "Tanzania":
                    countryCode = "TZS";
                    break;
                case "Ukraine":
                    countryCode = "UAH";
                    break;
                case "Uganda":
                    countryCode = "UGX";
                    break;
                case "United States":
                    countryCode = "USD";
                    break;
                case "Uruguay":
                    countryCode = "UYU";
                    break;
                case "Uzbekistan":
                    countryCode = "UZS";
                    break;
                case "Venezuela":
                    countryCode = "VES";
                    break;
                case "Vietnam":
                    countryCode = "VND";
                    break;
                case "Vanuatu":
                    countryCode = "VUV";
                    break;
                case "Samoa":
                    countryCode = "WST";
                    break;
                case "CFA Franc BEAC":
                    countryCode = "XAF";
                    break;
                case "East Caribbean":
                    countryCode = "XCD";
                    break;
                case "Special Drawing Rights":
                    countryCode = "XDR";
                    break;
                case "CFA Franc BCEAO":
                    countryCode = "XOF";
                    break;
                case "CFP Franc":
                    countryCode = "XPF";
                    break;
                case "Yemen":
                    countryCode = "YER";
                    break;
                case "South Africa":
                    countryCode = "ZAR";
                    break;
                case "Zambia":
                    countryCode = "ZMW";
                    break;
                case "Zimbabwe":
                    countryCode = "ZWL";
                    break;
                default:
                    countryCode = "Unknown";
                    break;
            }

                convert_CAD_to_SelectedCurrency(countryCode);
                setCurrencySymbolValue(countryCode);
                return countryCode;
            })
            .catch(error => {
            console.error('Error fetching location:', error);
            });
        })
        .catch(error => {
        console.error('Error fetching IP address:', error);
        });
    }

export async function getExchangeRates(baseCurrency) {
    const apiUrl = `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data.rates;
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        return null;
    }
}

export function convert_CAD_to_SelectedCurrency(selected_currency){
    const baseCurrency = 'CAD';
                getExchangeRates(baseCurrency)
                    .then(async (rates) => {
                        if (selected_currency !== undefined) {
                            exchange_rate = rates[selected_currency];
                            const exchangeRate = {
                                code: selected_currency,
                                value: exchange_rate,
                            }
                            await updateDoc(doc(db, 'users', uid),{
                                exchange_rate: exchangeRate
                            }).then(async function(){
                                console.log('Saved');
                                await localStorage.clear();
                                window.location.reload();
                            })
                            await localStorage.setItem('currencyCode', selected_currency);
                            await localStorage.setItem('exchange_rate', JSON.stringify(exchangeRate));
                            
                            return rates[selected_currency];
                        } else {
                            return 1;
                        }
                    });
}


//SET THE CURRENCY
export function setCurrencySymbolValue(value) {
    const currencySymbolElements = document.querySelectorAll("span.currencyCodes");
    currencySymbolElements.forEach(element => {
        element.textContent = value;
    });
}