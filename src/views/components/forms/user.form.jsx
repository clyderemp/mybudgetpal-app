import React, { useState } from "react";
import CustomInput from "../customs/customInput";
import CustomButton from "../customs/customButton";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const UserForm = ({ data, onSubmit }) => {
  const [formData, setFormData] = useState(data ?? {});

  const handleChange = (name) => (e) => {
    const value = e?.target ? e.target.value : e;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {/* First Name */}
      <CustomInput
        type="text"
        value={formData.fname || ""}
        onChange={handleChange("fname")}
        placeholder="First Name"
        required
      />

      {/* Last Name */}
      <CustomInput
        type="text"
        value={formData.lname || ""}
        onChange={handleChange("lname")}
        placeholder="Last Name"
        required
      />

      {/* Gender Dropdown */}
      <CustomInput
        type="dropdown"
        value={formData.gender || ""}
        onChange={handleChange("gender")}
        placeholder="Gender"
        options={GENDER_OPTIONS}
        required
      />

      {/* Birthday */}
      <CustomInput
        type="date"
        value={formData.dob || ""}
        onChange={handleChange("dob")}
        placeholder="Birthday"
      />

      {/* Submit Button */}
      <CustomButton type="submit" label="Save" className="px-4 py-2" />
    </form>
  );
};

export default UserForm;
