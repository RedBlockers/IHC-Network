import { useState } from "react";
import RegisterStep1 from "./register-step1.jsx";
import RegisterStep2 from "./register-step2.jsx";
import RegisterStep3 from "./register-step3.jsx";
import RegisterStep4 from "./register-step4.jsx";
import { RegisterProvider } from "../../context/registerContext.jsx";

const steps = [RegisterStep1, RegisterStep2, RegisterStep3, RegisterStep4];

export default function Register() {
  const [step, setStep] = useState(1);
  const StepComponent = steps[step - 1];

  console.log("Current step:", step);
  return (
    <RegisterProvider>
      <StepComponent step={step} setStep={setStep} totalSteps={steps.length} />
    </RegisterProvider>
  );
}
