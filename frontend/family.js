document.getElementById("familyLoginForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById("familyLoginError");
  const button = document.getElementById("familyLoginButton");
  error.hidden = true;
  button.disabled = true;
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.elements.username.value.trim(), password: form.elements.password.value, loginType: "family" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      error.textContent = data.message || "Invalid Family Login credentials.";
      error.hidden = false;
      button.disabled = false;
      return;
    }
    localStorage.setItem("ganeshToken", data.token);
    window.location.replace("/admin.html");
  } catch (requestError) {
    error.textContent = "Network error: " + requestError.message;
    error.hidden = false;
    button.disabled = false;
  }
});