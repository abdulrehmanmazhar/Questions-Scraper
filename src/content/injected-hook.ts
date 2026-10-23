(async () => {
  const TAG = "INJECTED_HOOK";

  let confirmations = 0;

  window.confirm = (message?: string) => {
    console.log(message);
    confirmations++;

    console.log(confirmations);

    // if (confirmations === 2) {
    //   window.location.href =
    //     "https://app2.canada.com/member/qbank//test/create";
    // }
    return true;
  };

  console.log(`[${TAG}] page hook installed`);
})();
