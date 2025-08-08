// src/constants/paymentProviders.constants.js

export const PAYMENT_PROVIDERS = [
  {
    provider: "Visa",
    logoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/d/d6/Visa_2021.svg",
  },
  {
    provider: "Mastercard",
    logoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg",
  },
  {
    provider: "American Express",
    logoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/American_Express_logo_%282018%29.svg/2052px-American_Express_logo_%282018%29.svg.png",
  },
  {
    provider: "Apple Pay",
    logoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
  },
  {
    provider: "Google Pay",
    logoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_Play_2022_icon.svg/1856px-Google_Play_2022_icon.svg.png",
  },
];

export const BANKS = {
  UAE: [
    {
      name: "Emirates NBD",
      logoUrl:
        "https://s3-eu-west-1.amazonaws.com/tpd/logos/5531df8c0000ff00057ed682/0x0.png",
      color: "from-[#0055A4] to-[#003B7A]", // Emirates NBD blue gradient
    },
    {
      name: "Mashreq Bank",
      logoUrl:
        "https://companieslogo.com/img/orig/MASQ.AE-b739716f.png?t=1720244492",
      color: "from-[#F7941D] to-[#FF5E00]", // Mashreq orange gradient
    },
    {
      name: "Abu Dhabi Commercial Bank (ADCB)",
      logoUrl:
        "https://companieslogo.com/img/orig/ADCB.AE-6c60c638.png?t=1720244490",
      color: "from-[#E30613] to-[#9D0A0F]", // ADCB red gradient
    },
  ],
};
