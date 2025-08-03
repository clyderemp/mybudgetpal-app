import { useBackendServices } from "@/services/server/backend.services";
import { useFirestoreServices } from "@/services/client/firebase-firestore.service";
import { arrayUnion } from "firebase/firestore";

class ActionUtils {
  constructor() {
    this.actions = {
      LOGIN: "login",
      LOGOUT: "logout",
      OPEN: "open",
      RELOAD: "reload",

      CREATE_USER: "create_user",
      EDIT_USER: "edit_user",
      DELETE_USER: "delete_user",

      CREATE_ADMIN: "create_admin",
      EDIT_ADMIN: "edit_admin",
      DELETE_ADMIN: "delete_admin",

      UPDATE_PROFILE: "update_profile",
      CHANGE_PASSWORD: "change_password",
      UPDATE_SETTINGS: "update_settings",

      EXPORT_DATA: "export_data",
      IMPORT_DATA: "import_data",
      GENERATE_REPORT: "generate_report",

      OPEN_MODAL: "open_modal",
      CLOSE_MODAL: "close_modal",
      VIEW_DETAILS: "view_details",

      OTHER: "other",
    };
    this.userData = null;
  }

  setUserData(userData) {
    this.userData = userData;
  }

  async logAction(uid, action) {
    if (!uid) {
      console.warn("ActionUtils: UID is required to log action.");
      return;
    }

    const entry = {
      action,
      date: new Date().toISOString(),
    };

    try {
      await useFirestoreServices.updateDocument(`users`, uid, {
        actions: arrayUnion(entry),
      });
    } catch (err) {
      console.error(err);
    }
  }

  async onLogin(uid) {
    await this.logAction(uid, this.actions.LOGIN);
  }

  async onLogout(uid) {
    await this.logAction(uid, this.actions.LOGOUT);
  }

  async onOpen(uid) {
    await this.logAction(uid, this.actions.OPEN);
  }

  async onReload(uid) {
    await this.logAction(uid, this.actions.RELOAD);
  }

  async onCreateUser(uid) {
    await this.logAction(uid, this.actions.CREATE_USER);
  }

  async onEditUser(uid) {
    await this.logAction(uid, this.actions.EDIT_USER);
  }

  async onDeleteUser(uid) {
    await this.logAction(uid, this.actions.DELETE_USER);
  }

  async onCreateAdmin(uid) {
    await this.logAction(uid, this.actions.CREATE_ADMIN);
  }

  async onEditAdmin(uid) {
    await this.logAction(uid, this.actions.EDIT_ADMIN);
  }

  async onDeleteAdmin(uid) {
    await this.logAction(uid, this.actions.DELETE_ADMIN);
  }

  async onUpdateProfile(uid) {
    await this.logAction(uid, this.actions.UPDATE_PROFILE);
  }

  async onChangePassword(uid) {
    await this.logAction(uid, this.actions.CHANGE_PASSWORD);
  }

  async onUpdateSettings(uid) {
    await this.logAction(uid, this.actions.UPDATE_SETTINGS);
  }

  async onExportData(uid) {
    await this.logAction(uid, this.actions.EXPORT_DATA);
  }

  async onImportData(uid) {
    await this.logAction(uid, this.actions.IMPORT_DATA);
  }

  async onGenerateReport(uid) {
    await this.logAction(uid, this.actions.GENERATE_REPORT);
  }

  async onOpenModal(uid) {
    await this.logAction(uid, this.actions.OPEN_MODAL);
  }

  async onCloseModal(uid) {
    await this.logAction(uid, this.actions.CLOSE_MODAL);
  }

  async onViewDetails(uid) {
    await this.logAction(uid, this.actions.VIEW_DETAILS);
  }

  async onCustom(uid, actionName = "other") {
    await this.logAction(uid, actionName);
  }
}

export const useActionUtils = new ActionUtils();
