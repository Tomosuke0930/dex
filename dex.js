// connect to Moralis server
const serverUrl = "SECRET_SERVER";
const appId = "SECRET_APP_ID";

Moralis.start({ serverUrl, appId });

Moralis.initPlugins().then(() => console.log("Plugins have been initialized"));

const $tokenBalanceTBody = document.querySelector(".js-token-balances");
const $selectedToken = document.querySelector(".js-from-token");
const $amountInput = document.querySelector(".js-from-amount");

/* Utilities  */
// Convert token value to ETH style with 6 decimals
const tokenValue = (value, decimals) =>
  decimals ? value / Math.pow(10, decimals) : value;

/* Login, Logout,  */

async function login() {
  let user = Moralis.User.current();
  if (!user) {
    user = await Moralis.authenticate();
  }
  console.log("logged in user:", user);
  getStats();
}

async function initSwapForm(event) {
  event.preventDefault(); //check
  $selectedToken.innerText = event.target.dataset.symbol;
  $selectedToken.dataset.address = event.target.dataset.address;
  $selectedToken.dataset.decimals = event.target.dataset.decimals;
  $selectedToken.dataset.max = event.target.dataset.max;
  $amountInput.removeAttribute("disabled");
  $amountInput.value = "";
  document.querySelector(".js-submit").removeAttribute("disabled");
  document.querySelector(".js-cancel").removeAttribute("disabled");
  document.querySelector(".js-quote-container").innerHTML = "";
  document.querySelector(".js-amount-error").innerText = "";
}

async function getStats() {
  const balances = await Moralis.Web3API.account.getTokenBalances({
    chain: "polygon",
  });
  console.log(balances);
  $tokenBalanceTBody.innerHTML = balances
    .map(
      (token, index) => `
          <tr>
              <td>${index + 1}</td>
              <td>${token.symbol}</td>
              <td>${tokenValue(token.balance, token.decimals)}</td>
              <td>
                <button
                    class="js-swap btn btn-primary"
                    data-address="${token.token_address}"
                    data-symbol = "${token.symbol}"
                    data-decimals = "${token.decimals}"
                    data-max="${tokenValue(token.balance, token.decimals)}"
                >
                    Swap

                </button>
              </td>
          <tr>
      `
    )
    .join("");

  for (let $btn of $tokenBalanceTBody.querySelectorAll(".js-swap")) {
    $btn.addEventListener("click", initSwapForm);
  }
}

async function buyCrypto() {
  Moralis.Plugins.fiat.buy();
}
async function logOut() {
  await Moralis.User.logOut();
  console.log("logged out");
}

document.querySelector("#btn-login").addEventListener("click", login);
document.getElementById("btn-buy-crypto").addEventListener("click", buyCrypto);
document.getElementById("btn-logout").addEventListener("click", logOut);

/* Quote / Swap  */
async function formSubmitted(event) {
  event.preventDefault(); //check
  const fromAmount = Number.parseFloat($amountInput.value);
  const fromMaxValue = Number.parseFloat($selectedToken.dataset.max);
  if (Number.isNaN(fromAmount) || fromAmount > fromMaxValue) {
    document.querySelector(".js-amount-error").innerText = "Invalid amout";
  } else {
    document.querySelector(".js-amount-error").innerText = "";
  }

  const fromDecimals = $selectedToken.dataset.decimals;
  const fromTokenAddress = $selectedToken.dataset.address;

  //  - を境に2つの変数に格納している
  const [toTokenAddress, toDecimals] = document
    .querySelector("[name=to-token]")
    .value.split("-");

  try {
    const quote = await Moralis.Plugins.oneInch.quote({
      chain: "polygon",
      fromTokenAddress,
      toTokenAddress,
      amount: Moralis.Units.Token(fromAmount, fromDecimals).toString(),
    });
    //   console.log(quote);

    const toAmount = tokenValue(quote.toTokenAmount, toDecimals);
    document.querySelector(".js-quote-container").innerHTML = `
    <p>
    ${fromAmount} ${quote.fromToken.symbol} 
    = ${toAmount} ${quote.toToken.symbol}
    </p>
    <p>
        Gass fee: ${quote.estimatedGas}  
    </p>
   <img width="100%" src="https://cdn2.slidemodel.com/wp-content/uploads/90133-01-cryptocurrency-project-proposal-powerpoint-template-16x9-12.jpg"/>
    `;
  } catch (e) {
    document.querySelector(".js-quote-container").innerHTML = `
      <p class="error">The conversion didn't succeed.</p>

      `;
  }
}


async function formCanceled(event) {
  event.preventDefault(); //check
  document.querySelector(".js-submit").setAttribute("disabled", "");
  document.querySelector(".js-cancel").setAttribute("disabled", "");
  $amountInput.value = "";
  $amountInput.setAttribute("disabled", "");
  delete $selectedToken.dataset.address;
  delete $selectedToken.dataset.decimals;
  delete $selectedToken.dataset.max;
  document.querySelector(".js-quote-container").innerHTML = "";
  document.querySelector(".js-quote-error").innerHTML = "";
}

document.querySelector(".js-submit").addEventListener("click", formSubmitted);
document.querySelector(".js-cancel").addEventListener("click", formCanceled);

/* To token dropdown preparation  */

async function getTop10Tokens() {
  const response = await fetch("https://api.coinpaprika.com/v1/coins");
  const tokens = await response.json();

  return tokens
    .filter((token) => token.rank >= 1 && token.rank <= 30)
    .map((token) => token.symbol);
}

async function getTickerData(tickerList) {
  const tokens = await Moralis.Plugins.oneInch.getSupportedTokens({
    chain: "polygon",
  });

  const tokenList = Object.values(tokens.tokens);

  return tokenList.filter((token) => tickerList.includes(token.symbol));
}

function renderTokenDropdown(tokens) {
  const options = tokens
    .map(
      (token) => `
        <option value="${token.address}-${token.decimals}">
            ${token.name}
        </option>
    `
    )
    .join("");
  document.querySelector("[name=to-token]").innerHTML = options;
}

getTop10Tokens().then(getTickerData).then(renderTokenDropdown);
