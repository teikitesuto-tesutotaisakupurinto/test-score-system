
async function handleLogin() {

  const email =
    document.getElementById(
      "email"
    ).value.trim();


  const password =
    document.getElementById(
      "password"
    ).value;


  const button =
    document.getElementById(
      "loginButton"
    );


  const errorElement =
    document.getElementById(
      "loginError"
    );


  if (errorElement) {

    errorElement.textContent =
      "";

  }


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "ログイン中...";

  }


  try {

    await login(
      email,
      password
    );


    await redirectAfterLogin();

  } catch (error) {

    console.error(
      "Login:",
      error
    );


    if (errorElement) {

      errorElement.textContent =
        "メールアドレスまたはパスワードが正しくありません。";

    } else {

      alert(
        "ログインできませんでした。"
      );

    }


    if (button) {

      button.disabled =
        false;

      button.textContent =
        "ログイン";

    }

  }

}
