import {
  BANKS,
  PAYMENT_PROVIDERS,
} from "@/constants/paymentProviders.constants";
import { ACCOUNT_TYPES } from "@/constants/transaction.constants";
import { useAuth } from "@/context/auth.provider";

const formatCardNumber = (num = "") => {
  return (
    num
      .replace(/\D/g, "")
      .match(/.{1,4}/g)
      ?.join(" ") || "0000 0000 0000 0000"
  );
};

const maskCardNumber = (num = "") => {
  const clean = num.replace(/\D/g, "");
  const last4 = clean.slice(-4);
  return `xxxx xxxx xxxx ${last4}`;
};

const getProviderLogo = (provider) => {
  const match = PAYMENT_PROVIDERS.find(
    (p) => p.provider.toLowerCase() === provider?.toLowerCase()
  );
  return match?.logoUrl || null;
};

const getBankLogo = (bankName) => {
  const bank = BANKS.UAE.find((b) =>
    b.name.toLowerCase().includes(bankName?.toLowerCase())
  );
  return bank?.logoUrl || null;
};

const getCardColor = (bankName) => {
  const bank = BANKS.UAE.find((b) =>
    b.name.toLowerCase().includes(bankName?.toLowerCase())
  );
  return bank?.color || "bg-primary";
};

const getAccountType = (type) => {
  const accountType = ACCOUNT_TYPES.find((b) => b.value === type);
  return accountType?.label || "";
};

const getAccountHolderDetails = (ownerID) => {
  const { accountUsers } = useAuth();
  const accountHolder = accountUsers?.[ownerID];
  return `${accountHolder?.fname || ""} ${accountHolder?.lname || ""}`.trim();
};

const getCardDetails = (cardID) => {
  const { financialAccounts } = useAuth();
  const selectedCard = financialAccounts?.find((b) => b.id === cardID);
  if (selectedCard) {
    const accountHolder = getAccountHolderDetails(selectedCard.owner);
    const bankLogo = getBankLogo(selectedCard?.bank);
    return {
      ...selectedCard,
      owner: accountHolder,
      bankLogo,
      string: `${accountHolder?.split(" ")[0]}'s ${
        selectedCard?.accountType ?? selectedCard?.bank
      }`,
    };
  } else return selectedCard;
};

export const usePaymentCardUtils = {
  formatCardNumber,
  maskCardNumber,
  getProviderLogo,
  getBankLogo,
  getCardColor,
  getAccountHolderDetails,
  getAccountType,
  getCardDetails,
};
