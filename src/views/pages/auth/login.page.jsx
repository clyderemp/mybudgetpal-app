import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth.provider";
import { useToast } from "@/context/toast.provider";
import CustomInput from "@/views/components/customs/customInput";
import CustomText from "@/views/components/customs/customText";
import CustomButton from "@/views/components/customs/customButton";
import Logo from "@/assets/logos/icon.png";
import { useFormUtils } from "@/utils/form.utils";
import Loader from "@/views/components/static/Loader";
import { useActionUtils } from "@/utils/action.utils";

export default function Login() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: false, password: false });
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await login(credentials);

      if (response?.success) {
        try {
          await useActionUtils.onLogin(response?.uid);
        } catch {}
        navigate("/");
      } else {
        setErrors(response.errors);
        showToast(response?.message, "error");
      }
    } catch (error) {
      showToast(error?.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const updateData = (key, value) => {
    useFormUtils.updateData(key, value, setCredentials);
  };

  if (loading) {
    return <Loader text="Signing in" />;
  } else {
    return (
      <div className="bg-white relative min-h-screen w-full font-pt font-bold text-gray-900 overflow-hidden flex items-center justify-center px-4">
        {/* Login form container */}
        <form
          onSubmit={handleLogin}
          className="relative z-10 p-10 max-w-sm w-full flex flex-col items-center min-w-[320px]"
        >
          {/* Logo */}
          <div className="mb-6">
            <img
              src={Logo}
              alt="Blindate Logo"
              className="mx-auto w-20 h-20 object-contain bg-primary rounded-[10px]"
            />
          </div>

          <CustomText
            container="my-4 p-2 rounded"
            content="text-lg font-semibold text-secondary"
          >
            Welcome to <span className="font-default">Blin</span>
            <span className="font-semibold">Date</span>
          </CustomText>

          <CustomInput
            type="text"
            value={credentials.email}
            onChange={(e) => {
              updateData("email", e.target.value);
            }}
            placeholder="Username"
            shape="h-12 rounded-2xl my-2 bg-gray-100"
            border="border border-gray-300"
            text="text-sm"
            error={errors.email}
          />
          <CustomInput
            type="password"
            value={credentials.password}
            onChange={(e) => {
              updateData("password", e.target.value);
            }}
            placeholder="Password"
            shape="h-12 rounded-2xl my-2 bg-gray-100"
            border="border border-gray-300"
            text="text-sm"
            error={errors.password}
          />

          <CustomButton
            isDisabled={
              credentials?.email === "" && credentials?.password === ""
            }
            label="Login"
            type="submit"
            shape="rounded-2xl h-12 mt-6 w-full hover:bg-blue-600"
            border="border-blue-600 border-[2px]"
            text="text-md text-white"
            useHoverBehaviour
          />
        </form>
      </div>
    );
  }
}
