import { NetworkTracker, WaitKit } from "../../shared/utils.js";

async function putCredentials() {
  const credentails = {
    email: "",
    password: "",
  };

  while (!credentails.email) {
    const email = window.prompt("Please enter your email", "");
    if (email) credentails.email = email;
  }

  while (!credentails.password) {
    const password = window.prompt("Please enter your password", "");
    if (password) credentails.password = password;
  }
  await WaitKit.waitForSelector("#email");
  const emailInput = document.querySelector<HTMLInputElement>("#email");

  await WaitKit.waitForSelector("#password");
  const passwordInput = document.querySelector<HTMLInputElement>("#password");

  if (!emailInput || !passwordInput) return;

  emailInput.value = credentails.email;
  passwordInput.value = credentails.password;
}

async function submitForm() {
  await WaitKit.waitForSelector("#button_login");
  const form = document.querySelector<HTMLButtonElement>("#button_login");
  if (!form) return;
  form.click();
}

export async function login() {
  await NetworkTracker.waitForNetworkIdle(10000);
  await putCredentials();
  await submitForm();
}
