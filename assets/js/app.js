// @ts-check
'use strict'

console.log('Script is OK! ༼ つ ◕_◕ ༽つ');

// Types
/** @typedef {import('./lib/chartjs/chart.js').Chart} Chart */
/** @typedef {Record<string, ?HTMLElement | undefined>} ElementList */
/** @typedef {Record<string, number>[]} ResultList */
/**
 * @callback CalcFunc
 * @param {?number} principal
 * @param {?number} annuityTerm
 * @param {?number} interestRate
 * @param {number} compound
 * @param {?number} monthlyIncome
 * @param {?number} annualIncrease
 * @returns {{ calculationResults: ResultList, outputResults: Record<string, string>}}
 */

const CRITICAL_ERROR_MESSAGE = "Please refresh the page and try again.";
const CALCULATION_FAILED_ERROR_MESSAGE = "Please check the input values are reasonable";
const CALCULATION_LIMIT_YEARS = 1000;
const CALCULATION_TOO_LONG_ERROR_MESSAGE = `This annuity will last longer than ${CALCULATION_LIMIT_YEARS} years. Please increase the monthly withdrawal`;

/** @param {Event} event */
function toggleRelatedInputs(event) {
    const element = /** @type {HTMLSelectElement} */ (event.target);
    const id = element.id;
    const index = element.selectedIndex;

    document.querySelectorAll('.' + id)?.forEach(element => {
        element.classList.add("related-item-hidden");
    });

    document.querySelectorAll(`.related-to-${id}-${index}`)?.forEach(element => {
        element.classList.remove("related-item-hidden");
    });
}

/** @param {Event} event */
function forceNumeric(event) {
    const element = /** @type {?HTMLInputElement} */ (event.target);
    if (!element) return;
    element.value = element.value
        .replace(/[^0-9.]/g, '')
        .replace(/(\..*?)\..*/g, '$1');
}

/**
 * @param {number} num
 * @param {number} decimals
 * @returns {number}
 */
function roundDown(num, decimals = 0) {
    const exp = Math.pow(10, decimals);
    return Math.floor(num * exp) / exp;
}

/**
 * @param {number} num
 * @param {number} decimals
 * @returns {number}
 */
function roundUp(num, decimals = 0) {
    const exp = Math.pow(10, decimals);
    return Math.ceil(num * exp) / exp;
}

/**
 * @param {number} num
 * @param {string} space
 * @returns {string}
 */
function currencyFormat(num, space = '&nbsp') {
    return `R${space}` + num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

/** 
 * @param {number} interestRate
 * @param {number} compound
 * @returns {number}
 */
function getInterestPayRate(interestRate, compound) {
    const cc = compound / 12;
    const interest = interestRate / 100 / compound;
    return Math.pow(1 + interest, cc) - 1;
}

/**
 * @param {ResultList} monthlyResults 
 * @returns {ResultList}
 */
function getAnnualResults(monthlyResults) {
    let annualResults = [];

    let totalInterest = 0;
    let totalWithdrawn = 0;

    let annualInterest = 0;
    let annualWithdrawals = 0;
    let annualStartBalance = undefined;

    monthlyResults.forEach((item, index) => {
        totalInterest += item.interestPayment;
        totalWithdrawn += item.withdrawal;
        annualInterest += item.interestPayment;
        annualWithdrawals += item.withdrawal;
        if (annualStartBalance === undefined) {
            annualStartBalance = item.startBalance;
        }

        if ((index + 1) % 12 === 0 || (index + 1) === monthlyResults.length) {
            annualResults.push({
                startBalance: annualStartBalance,
                endBalance: item.endBalance,
                interestPayment: annualInterest,
                withdrawal: annualWithdrawals,
                totalInterest,
                totalWithdrawn
            });
            annualInterest = 0;
            annualWithdrawals = 0;
            annualStartBalance = undefined;
        }
    });

    return annualResults;
}

/**
 * @param {number} principal
 * @param {number} annuityTerm
 * @param {number} interestRate
 * @param {number} compound
 * @param {number} initialMonthlyIncome
 * @param {number} annualIncrease
 */
function calculateResultFast(
    principal,
    annuityTerm,
    interestRate,
    compound,
    initialMonthlyIncome,
    annualIncrease,
) {
    const ratePayB = getInterestPayRate(interestRate, compound);

    let balance = principal;
    let monthlyIncome = initialMonthlyIncome;
    let finalWithdrawal = 0;

    let i = 0;
    while (balance >= 0.01) {
        if (i > 0 && i % 12 === 0) {
            monthlyIncome *= 1 + annualIncrease / 100;
        }
        if (i > 2 * annuityTerm * 12) {
            return {
                actualAnnuityTerm: Number.POSITIVE_INFINITY,
                finalMonthlyIncome: 0,
                finalWithdrawal: 0
            }
        }

        const interestPayment = balance * ratePayB;
        balance += interestPayment;

        const withdrawal = Math.min(balance, monthlyIncome)
        balance -= withdrawal;
        finalWithdrawal = withdrawal;

        i++;
    }

    const actualAnnuityTerm = i / 12;

    return { actualAnnuityTerm, finalMonthlyIncome: monthlyIncome, finalWithdrawal };
}

/**
 * @param {number} principal
 * @param {?number} annuityTerm
 * @param {number} interestRate
 * @param {number} compound
 * @param {number} initialMonthlyIncome
 * @param {number} annualIncrease
 */
function calculateResult(
    principal,
    annuityTerm,
    interestRate,
    compound,
    initialMonthlyIncome,
    annualIncrease,
) {
    const ratePayB = getInterestPayRate(interestRate, compound);

    const results = [];
    let balance = principal;
    let monthlyIncome = initialMonthlyIncome;

    let i = 0;
    while (balance >= 0.01) {
        if (i > 0 && i % 12 === 0) {
            monthlyIncome *= 1 + annualIncrease / 100;
        }
        if (annuityTerm && i > 2 * annuityTerm * 12) {
            input.error([], CALCULATION_FAILED_ERROR_MESSAGE, true);
            throw new Error("Invalid state");
        } else if (!annuityTerm && i > CALCULATION_LIMIT_YEARS * 12) {
            input.error([], CALCULATION_TOO_LONG_ERROR_MESSAGE, true);
            throw new Error("Calculation ran for too long");
        }

        const startBalance = balance;

        const interestPayment = balance * ratePayB;
        balance += interestPayment;

        const withdrawal = Math.min(balance, monthlyIncome)
        balance -= withdrawal;

        results.push({
            startBalance,
            endBalance: balance,
            interestPayment,
            withdrawal
        });

        i++;
    }

    const actualAnnuityTerm = results.length / 12;

    return { results, actualAnnuityTerm, finalMonthlyIncome: monthlyIncome };
}

const DELTA = 0.0000000001;
const RETRY_COUNT = 10;
const DELTA_COUNT = 18;

/**
 * @param {(v: number) => number} resultGetter 
 * @param {number} initialIncrement 
 * @param {'increasing'|'decreasing'} type
 * @param {number} [initialValue]
 * @returns {number}
 */
function findParameter(
    resultGetter,
    type,
    initialIncrement,
    initialValue = 0.1,
) {
    let delta = DELTA;
    for (let d = 0; d < DELTA_COUNT; d++) {
        let dm = 1 - delta;
        let dp = 1;
        for (let r = 0; r <= RETRY_COUNT; r++) {
            let value = initialValue;
            let increment = initialIncrement * Math.pow(2, r);
            for (let i = 0; i < 1000; i++) {
                const ratio = resultGetter(value);
                if (ratio < dm) {
                    value -= increment;
                    if (type === 'increasing') {
                        increment = increment / 2;
                    }
                } else if (ratio >= dm && ratio <= dp) {
                    if (value < 0) {
                        input.error([], CALCULATION_FAILED_ERROR_MESSAGE, true);
                        throw new Error("Calculation failed");
                    }
                    return value;
                } else {
                    value += increment;
                    if (type === 'decreasing') {
                        increment = increment / 2;
                    }
                }
            }
        }
        delta *= 10;
    }

    input.error([], CALCULATION_FAILED_ERROR_MESSAGE, true);
    throw new Error("Calculation Failed");
}

/**
 * @param {(v: number) => number} resultGetter 
 * @param {'increasing'|'decreasing'} type
 * @param {number} initialIncrement 
 * @param {number} initialValue 
 * @returns {number}
 */
function findMoneyParameter(
    resultGetter,
    type,
    initialIncrement,
    initialValue = 0.1,
) {
    const value = findParameter(resultGetter, type, initialIncrement, initialValue);
    const moneyValue = type === 'increasing'
        ? roundDown(value, 2)
        : roundUp(value, 2);

    return moneyValue;
}

/** @type {CalcFunc} */
function calculateMonthlyIncome(
    principal,
    annuityTerm,
    interestRate,
    compound,
    _monthlyIncome,
    annualIncrease,
) {
    if (
        principal === null ||
        annuityTerm === null ||
        interestRate === null ||
        annualIncrease === null
    ) {
        input.error([], CRITICAL_ERROR_MESSAGE, true);
        throw new Error("Invalid state");
    }

    const ratePayB = getInterestPayRate(interestRate, compound);
    const firstInterestPayment = principal * ratePayB;

    const income = findMoneyParameter((i) => {
        const { actualAnnuityTerm, finalWithdrawal, finalMonthlyIncome } = calculateResultFast(
            principal,
            annuityTerm,
            interestRate,
            compound,
            i,
            annualIncrease,
        );
        if (actualAnnuityTerm === annuityTerm) {
            return finalWithdrawal / finalMonthlyIncome;
        } else {
            return actualAnnuityTerm / annuityTerm;
        }
    }, 'decreasing', 100, firstInterestPayment);

    const { results } = calculateResult(
        principal,
        annuityTerm,
        interestRate,
        compound,
        income,
        annualIncrease,
    );

    const totalWithdrawn = results.map(it => it.withdrawal).reduce((a, b) => a + b);
    const totalInterest = results.map(it => it.interestPayment).reduce((a, b) => a + b);
    const initialAnnualIncome = income * Math.min(12, results.length);
    const drawDown = initialAnnualIncome / Math.max(principal, initialAnnualIncome) * 100;

    return {
        calculationResults: results,
        outputResults: {
            main: `Monthly Income: ${currencyFormat(income)} <br /> Increasing at ${annualIncrease}% per annum`,
            smallA: `Initial Annual Income: ${currencyFormat(initialAnnualIncome)} <br /> Draw Down Percentage: ${drawDown.toFixed(1)}%`,
            smallB: `Total Withdrawn: ${currencyFormat(totalWithdrawn)}`,
            smallC: `Total Interest: ${currencyFormat(totalInterest)}`,
        }
    }
}

/** @type {CalcFunc} */
function calculateAnnuityTerm(
    principal,
    annuityTerm,
    interestRate,
    compound,
    monthlyIncome,
    annualIncrease,
) {
    if (
        principal === null ||
        interestRate === null ||
        monthlyIncome === null ||
        annualIncrease === null
    ) {
        input.error([], CRITICAL_ERROR_MESSAGE, true);
        throw new Error("Invalid state");
    }
    console.warn("annuityTerm: ", annuityTerm);
    const { results, actualAnnuityTerm } = calculateResult(
        principal,
        annuityTerm,
        interestRate,
        compound,
        monthlyIncome,
        annualIncrease,
    );

    const totalWithdrawn = results.map(it => it.withdrawal).reduce((a, b) => a + b);
    const totalInterest = results.map(it => it.interestPayment).reduce((a, b) => a + b);
    const initialAnnualIncome = monthlyIncome * Math.min(12, results.length);
    const drawDown = initialAnnualIncome / Math.max(principal, initialAnnualIncome) * 100;

    return {
        calculationResults: results,
        outputResults: {
            main: `Annuity Term: ${actualAnnuityTerm.toFixed(1)} years`,
            smallA: `Initial Annual Income: ${currencyFormat(initialAnnualIncome)} <br /> Draw Down Percentage: ${drawDown.toFixed(1)}%`,
            smallB: `Total Withdrawn: ${currencyFormat(totalWithdrawn)}`,
            smallC: `Total Interest: ${currencyFormat(totalInterest)}`,
        }
    }
}

/** @type {CalcFunc} */
function calculateStartingPrincipal(
    _principal,
    annuityTerm,
    interestRate,
    compound,
    monthlyIncome,
    annualIncrease,
) {
    if (
        annuityTerm === null ||
        interestRate === null ||
        monthlyIncome === null ||
        annualIncrease === null
    ) {
        input.error([], CRITICAL_ERROR_MESSAGE, true);
        throw new Error("Invalid state");
    }

    const principal = findMoneyParameter((p) => {
        const { actualAnnuityTerm, finalWithdrawal, finalMonthlyIncome } = calculateResultFast(
            p,
            annuityTerm,
            interestRate,
            compound,
            monthlyIncome,
            annualIncrease,
        );
        if (actualAnnuityTerm === annuityTerm) {
            return finalMonthlyIncome / finalWithdrawal;
        } else {
            return annuityTerm / actualAnnuityTerm;
        }
    }, 'increasing', monthlyIncome, monthlyIncome);

    const { results } = calculateResult(
        principal,
        annuityTerm,
        interestRate,
        compound,
        monthlyIncome,
        annualIncrease,
    );

    const totalWithdrawn = results.map(it => it.withdrawal).reduce((a, b) => a + b);
    const totalInterest = results.map(it => it.interestPayment).reduce((a, b) => a + b);
    const initialAnnualIncome = monthlyIncome * Math.min(12, results.length);
    const drawDown = initialAnnualIncome / Math.max(principal, initialAnnualIncome) * 100;

    return {
        calculationResults: results,
        outputResults: {
            main: `Principal: ${currencyFormat(principal)}`,
            smallA: `Initial Annual Income: ${currencyFormat(initialAnnualIncome)} <br /> Draw Down Percentage: ${drawDown.toFixed(1)}%`,
            smallB: `Total Withdrawn: ${currencyFormat(totalWithdrawn)}`,
            smallC: `Total Interest: ${currencyFormat(totalInterest)}`,
        }
    }
}

/** @type {CalcFunc} */
function calculateInterestRate(
    principal,
    annuityTerm,
    _interestRate,
    compound,
    monthlyIncome,
    annualIncrease,
) {
    if (
        principal == null ||
        annuityTerm === null ||
        monthlyIncome === null ||
        annualIncrease === null
    ) {
        input.error([], CRITICAL_ERROR_MESSAGE, true);
        throw new Error("Invalid state");
    }

    const rate = findParameter((r) => {
        const { actualAnnuityTerm, finalWithdrawal, finalMonthlyIncome } = calculateResultFast(
            principal,
            annuityTerm,
            r,
            compound,
            monthlyIncome,
            annualIncrease,
        );
        if (actualAnnuityTerm === annuityTerm) {
            return finalMonthlyIncome / finalWithdrawal;
        } else {
            return annuityTerm / actualAnnuityTerm;
        }
    }, 'increasing', 1, 0);

    const interestRate = roundDown(rate, 3);

    const { results } = calculateResult(
        principal,
        annuityTerm,
        interestRate,
        compound,
        monthlyIncome,
        annualIncrease,
    );

    const totalWithdrawn = results.map(it => it.withdrawal).reduce((a, b) => a + b);
    const totalInterest = results.map(it => it.interestPayment).reduce((a, b) => a + b);
    const initialAnnualIncome = monthlyIncome * Math.min(12, results.length);
    const drawDown = initialAnnualIncome / Math.max(principal, initialAnnualIncome) * 100;

    return {
        calculationResults: results,
        outputResults: {
            main: `Interest Rate: ${interestRate}% `,
            smallA: `Initial Annual Income: ${currencyFormat(initialAnnualIncome)} <br /> Draw Down Percentage: ${drawDown.toFixed(1)}%`,
            smallB: `Total Withdrawn: ${currencyFormat(totalWithdrawn)}`,
            smallC: `Total Interest: ${currencyFormat(totalInterest)}`,
        }
    }
}

/** @param {?number} compoundIndex */
function getCompoundFromIndex(compoundIndex) {
    switch (compoundIndex) {
        case 0:
            return 12;
        case 1:
            return 2;
        case 2:
            return 4;
        case 3:
            return 24;
        case 4:
            return 26;
        case 5:
            return 52;
        case 6:
            return 365;
        default:
            input.error([], CRITICAL_ERROR_MESSAGE, true);
            throw new Error(`Invalid compound index: ${compoundIndex}`);
    }
}

/** 
 * @param {?number} calcTypeIndex 
 * @returns {CalcFunc}
 */
function getCalcFuncFromIndex(calcTypeIndex) {
    switch (calcTypeIndex) {
        case 0: return calculateMonthlyIncome;
        case 1: return calculateAnnuityTerm;
        case 2: return calculateStartingPrincipal;
        case 3: return calculateInterestRate;
        default:
            input.error([], CRITICAL_ERROR_MESSAGE, true);
            throw new Error(`Invalid calculation type index: ${calcTypeIndex}`);
    }
}

const customDataLabels = {
    id: 'customDataLabel',
    afterDatasetDraw(chart, args, pluginOptions) {
        const {
            ctx,
            data
        } = chart;
        ctx.save();

        data.datasets[0].data.forEach((datapoint, index) => {
            const { x, y } = chart.getDatasetMeta(0).data[index].tooltipPosition();

            ctx.textAlign = 'center';
            ctx.font = '14px Inter';
            ctx.fillStyle = '#fff';
            ctx.textBaseline = 'middle';
            let toolTipText = datapoint != '0' ? datapoint + '%' : '';
            ctx.fillText(toolTipText, x, y);
        });
    },
};

const colors = {
    primary: '#162953',
    primaryLight: '#25468d',
    secondary: '#00ABD0'
};

const tooltip = {
    enabled: false,
    external: function (context) {
        let tooltipEl = document.getElementById('chartjs-tooltip');

        // Create element on first render
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'chartjs-tooltip';
            tooltipEl.innerHTML = '<table></table>';
            document.body.appendChild(tooltipEl);
        }

        // Hide if no tooltip
        const tooltipModel = context.tooltip;
        if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        // Set caret Position
        tooltipEl.classList.remove('above', 'below', 'no-transform');
        if (tooltipModel.yAlign) {
            tooltipEl.classList.add(tooltipModel.yAlign);
        } else {
            tooltipEl.classList.add('no-transform');
        }

        function getBody(bodyItem) {
            return bodyItem.lines;
        }

        if (tooltipModel.body) {
            const bodyLines = tooltipModel.body.map(getBody);

            let innerHtml = '<thead>';

            let year = +(Number(tooltipModel.title) * 12).toFixed(0);
            let months = +(year % 12).toFixed(0);
            let yearText = `Year ${(year - months) / 12}`;
            let monthText = months === 0 ? '' : `, Month ${months}`;
            innerHtml += '<tr><th class="loan-chart__title">' + yearText + monthText + '</th></tr>';

            innerHtml += '</thead><tbody>';
            bodyLines.forEach(function (body, i) {
                innerHtml += '<tr><td class="loan-chart__text">' + body + '</td></tr>';
            });
            innerHtml += '</tbody>';

            const tableRoot = tooltipEl.querySelector('table');
            if (tableRoot) {
                tableRoot.innerHTML = innerHtml;
            }
        }

        const position = context.chart.canvas.getBoundingClientRect();

        // Display, position, and set styles for font
        tooltipEl.style.opacity = '1';
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.left = position.left + window.scrollX + tooltipModel.caretX - tooltipEl.clientWidth / 2 + 'px';
        tooltipEl.style.top = position.top + window.scrollY + tooltipModel.caretY - tooltipEl.clientHeight / 2 + 'px';
        tooltipEl.classList.add('loan-chart');
    },
};

const secondaryChartData = [
    {
        data: [10, 60, 30],
        backgroundColor: [colors.primary, colors.primaryLight, colors.secondary],
        borderColor: colors.primary,
        borderWidth: 0.5,
    },
];

const primaryChartData = {
    labels: [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20
    ],
    datasets: [
        {
            label: 'Ending Balance',
            data: [
                1011487.7542384604,
                1020353.3987845862,
                1026200.5204456948,
                1028590.8649605507,
                1027040.4172628525,
                1021015.1340611085,
                1009926.2987599468,
                993125.4662041559,
                969898.9619690396,
                939461.8979311439,
                900951.6626127115,
                853420.8412802505,
                795829.5169697042,
                727036.899483187,
                645792.2249283986,
                550724.863522688,
                440333.56812806794,
                312974.7902871707,
                166849.98435655562,
                0
            ],
            stack: "1",
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        {
            label: 'Total Interest',
            data: [
                80415.15423845973,
                161654.56878458505,
                243494.14894569435,
                325676.57488555036,
                407907.81268410204,
                489853.2992534198,
                571133.7722118733,
                651320.7133286794,
                729931.3714497894,
                806423.3278859312,
                880188.564065239,
                950546.9878054045,
                1016739.3708211153,
                1077919.646027169,
                1133146.5087995797,
                1181374.261587429,
                1221442.836096046,
                1252066.9216535483,
                1271824.1222912525,
                1279142.0584744068
            ],
            stack: "2",
            backgroundColor: colors.primaryLight,
            borderColor: colors.primaryLight,
        },
        {
            label: 'Total Withdrawn',
            data: [
                68927.39999999998,
                141301.17000000004,
                217293.6285,
                297085.709925,
                380867.3954212497,
                468838.1651923122,
                561207.4734519279,
                658195.2471245249,
                760032.4094807511,
                866961.4299547888,
                979236.9014525289,
                1097126.1465251553,
                1220909.8538514138,
                1350882.7465439835,
                1487354.2838711827,
                1630649.3980647423,
                1781109.267967979,
                1939092.131366379,
                2104974.1379346983,
                2279142.058474407
            ],
            stack: "3",
            backgroundColor: colors.secondary,
            borderColor: colors.secondary,
        }
    ],
};

const $errorBox = /** @type {HTMLElement} */ (document.getElementById('error-box'));
const $errorList = /** @type {HTMLElement} */ (document.getElementById('error-list'));
const $annualResultsTable = /** @type {HTMLElement} */ (document.getElementById('annual-results'));
const $monthlyResultsTable = /** @type {HTMLElement} */ (document.getElementById('monthly-results'));

const $secondaryChart = /** @type {HTMLCanvasElement} */ (document.getElementById('secondary-chart'));
const $primaryChart = /** @type {HTMLCanvasElement} */ (document.getElementById('primary-chart'));
const $calculationType = /** @type {HTMLSelectElement} */ (document.getElementById('calc-type'));
const $calculateBtn = /** @type {HTMLButtonElement} */ (document.getElementById('calculate-btn'));

const calcInputs = /** @type {Record<number, ElementList>} */ ({
    0: {
        $startingPrincipal: document.getElementById('starting-principal-0'),
        $annuityTerm: document.getElementById('annuity-term-0'),
        $interestRate: document.getElementById('interest-rate-0'),
        $compound: document.getElementById('compound-0'),
        $annualIncrease: document.getElementById('annual-increase-0'),
    },
    1: {
        $startingPrincipal: document.getElementById('starting-principal-1'),
        $interestRate: document.getElementById('interest-rate-1'),
        $compound: document.getElementById('compound-1'),
        $monthlyIncome: document.getElementById('monthly-income-1'),
        $annualIncrease: document.getElementById('annual-increase-1'),
    },
    2: {
        $annuityTerm: document.getElementById('annuity-term-2'),
        $interestRate: document.getElementById('interest-rate-2'),
        $compound: document.getElementById('compound-2'),
        $monthlyIncome: document.getElementById('monthly-income-2'),
        $annualIncrease: document.getElementById('annual-increase-2'),
    },
    3: {
        $startingPrincipal: document.getElementById('starting-principal-3'),
        $annuityTerm: document.getElementById('annuity-term-3'),
        $compound: document.getElementById('compound-3'),
        $monthlyIncome: document.getElementById('monthly-income-3'),
        $annualIncrease: document.getElementById('annual-increase-3'),
    }
});

const calcOutputs = /** @type {Record<number, ElementList>} */ ({
    0: {
        $main: document.getElementById('result-main-0'),
        $smallA: document.getElementById('result-small-A-0'),
        $smallB: document.getElementById('result-small-B-0'),
        $smallC: document.getElementById('result-small-C-0'),
    },
    1: {
        $main: document.getElementById('result-main-1'),
        $smallA: document.getElementById('result-small-A-1'),
        $smallB: document.getElementById('result-small-B-1'),
        $smallC: document.getElementById('result-small-C-1'),
    },
    2: {
        $main: document.getElementById('result-main-2'),
        $smallA: document.getElementById('result-small-A-2'),
        $smallB: document.getElementById('result-small-B-2'),
        $smallC: document.getElementById('result-small-C-2'),
    },
    3: {
        $main: document.getElementById('result-main-3'),
        $smallA: document.getElementById('result-small-A-3'),
        $smallB: document.getElementById('result-small-B-3'),
        $smallC: document.getElementById('result-small-C-3'),
    },
})

const input = {
    value: /** @type {*} */ (null),
    elementId: "",
    shown: false,
    processed: false,
    silent: false,
    reset: function () {
        this.shown = false;
        $errorBox.classList.remove('calculator-result--error-active');
        document.querySelectorAll('.input-field--error')?.forEach(el => el.classList.remove('input-field--error'))
        document.querySelectorAll('.calculator-result:not(.calculator-result--error)').forEach(el => el.classList.remove('calculator-result--hidden'))
    },
    error: function (inputId, message = `Incorrect value for "${inputId}"`, last = false) {
        if (this.silent) return;
        if (this.processed) this.reset();
        if (!Array.isArray(inputId)) inputId = [inputId];
        for (const inputIdItem of inputId) {
            const wrapperElement = /** @type {?HTMLElement} */ (document.getElementById(inputIdItem)?.parentNode);
            wrapperElement?.classList.add('input-field--error');
        }
        if (!this.shown) {
            this.processed = false;
            this.shown = true;
            $errorList.innerHTML = '';
            $errorBox.classList.add('calculator-result--error-active');
            document.querySelectorAll('.calculator-result:not(.calculator-result--error)').forEach(el => el.classList.add('calculator-result--hidden'))
        }
        const element = document.createElement('p');
        element.classList.add('calculator-error__item');
        element.innerHTML = message;
        $errorList.append(element);
        if (last) this.processed = true;
    },
    valid: function () {
        if (!this.shown || this.processed) this.reset();
        this.processed = true;
        this.silent = false;
        return !this.shown;
    },
    get: function (elementId) {
        this.elementId = elementId;
        let element = /** @type {HTMLInputElement} */ (document.getElementById(elementId));
        this.silent = false;
        if (element == null) {
            this.value = null;
        } else {
            this.value = element.value;
        }
        return this;
    },
    index: function () {
        const element = /** @type {?HTMLSelectElement} */ (document.getElementById(this.elementId));
        this.value = element?.selectedIndex;
        return this;
    },
    checked: function (elementId) {
        const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId))
        this.value = element?.checked;
        return this;
    },
    split: function (separator) {
        this.value = this.value.split(separator);
        return this;
    },
    replace: function (pattern, replacement) {
        this.value = this.value.replace(pattern, replacement);
        return this;
    },
    default: function (value) {
        if (!this.value) this.value = value;
        return this;
    },
    optional: function (value) {
        if (!this.value) this.silent = true;
        return this;
    },
    gt: function (compare = 0, errorText = `The ${this.elementId} must be greater than ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) <= compare) this.error(this.elementId, errorText);
        return this;
    },
    gte: function (compare = 0, errorText = `The ${this.elementId} must be greater than or equal to ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) < compare) this.error(this.elementId, errorText);
        return this;
    },
    lt: function (compare = 0, errorText = `The ${this.elementId} must be less than ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) >= compare) this.error(this.elementId, errorText);
        return this;
    },
    lte: function (compare = 0, errorText = `The ${this.elementId} must be less than or equal to ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) > compare) this.error(this.elementId, errorText);
        return this;
    },
    integer: function (errorText = `The ${this.elementId
        } must be integer number (-3, -2, -1, 0, 1, 2, 3, ...).`) {
        if (!this.value.match(/^-?(0|[1-9]\d*)$/)) this.error(this.elementId, errorText);
        return this;
    },
    _naturalRegexp: /^([1-9]\d*)$/,
    natural: function (errorText = `The ${this.elementId} must be a natural number(1, 2, 3, ...).`) {
        if (!this.value.match(this._naturalRegexp)) this.error(this.elementId, errorText);
        return this;
    },
    natural_numbers: function (errorText = `The ${this.elementId} must be a set of natural numbers(1, 2, 3, ...).`) {
        this.split(/[ ,]+/);
        if (!this.value.every(value => value.match(this._naturalRegexp))) this.error(this.elementId, errorText);
        return this;
    },
    _mixedRegexp: /^(0|-?[1-9]\d*|-?[1-9]\d*\/[1-9]\d*|-?[1-9]\d*\s[1-9]\d*\/[1-9]\d*)$/,
    mixed: function (errorText = `The ${this.elementId} must be an integer / fraction / mixed number(1, 2 / 3, 4 5 / 6, ...).`) {
        if (!this.value.match(this._mixedRegexp)) this.error(this.elementId, errorText);
        return this;
    },
    mixed_numbers: function (errorText = `The ${this.elementId} must be a set of integer / fraction / mixed numbers(1, 2 / 3, 4 5 / 6, ...).`) {
        this.split(/,\s*/);
        if (!this.value.every(value => value.match(this._mixedRegexp))) this.error(this.elementId, errorText);
        return this;
    },
    number: function (errorText = `The "${this.elementId}" must be a number.`) {
        if (this.value === '' || isNaN(Number(this.value))) this.error(this.elementId, errorText);
        return this;
    },
    probability: function (errorText = `The "${this.elementId}" must be a number between 0 and 1.`) {
        if (this.value === '' || isNaN(Number(this.value)) || Number(this.value) < 0 || Number(this.value) > 1)
            this.error(this.elementId, errorText);
        return this;
    },
    percentage: function (errorText = `The "${this.elementId}" must be a number between 0 and 100.`) {
        if (this.value === '' || isNaN(Number(this.value)) || Number(this.value) < 0 || Number(this.value) > 100)
            this.error(this.elementId, errorText);
        return this;
    },
    numbers: function (errorText = `The ${this.elementId} must be a set of numbers.`) {
        if (this.value.filter(value => isNaN(Number(value))).length) this.error(this.elementId, errorText);
        return this;
    },
    whole: function (errorText = `The ${this.elementId} must be a whole number.`) {
        if (!this.value.match(/^(0|[1-9]\d*)$/)) this.error(this.elementId, errorText);
        return this;
    },
    positive: function (errorText = `The ${this.elementId} must be greater than 0.`) {
        this.gt(0, errorText);
        return this;
    },
    nonZero: function (errorText = `The ${this.elementId} must be non - zero.`) {
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else
            if (Number(this.value) == 0) this.error(this.elementId, errorText);
        return this;
    },
    nonNegative: function (errorText = `The ${this.elementId} must be greater than or equal to 0.`) {
        this.gte(0, errorText);
        return this;
    },
    negative: function (errorText = `The ${this.elementId} must be less than 0.`) {
        this.lt(0, errorText);
        return this;
    },
    bool: function () {
        return !!this.value;
    },
    val: function () {
        if (this.value === '' || this.value === null) return null;
        return Number(this.value);
    },
    vals: function () {
        return this.value.map(value => Number(value));
    },
    raw: function () {
        return this.value;
    }
}

/** @param {ResultList} annualResults */
const displayAnnualResultsTable = (annualResults) => {
    let annualResultsHtml = '';
    annualResults.forEach((r, index) => {
        annualResultsHtml += `<tr>
            <td class="text-center">${index + 1}</td>
            <td>${currencyFormat(r.startBalance)}</td>
            <td>${currencyFormat(r.interestPayment)}</td>
            <td>${currencyFormat(r.withdrawal)}</td>
            <td>${currencyFormat(r.endBalance)}</td>
        </tr>`;
    });

    $annualResultsTable.innerHTML = annualResultsHtml;
}

/** @param {ResultList} monthlyResults */
const displayMonthlyResultsTable = (monthlyResults) => {
    let monthlyResultsHtml = '';
    monthlyResults.forEach((item, index) => {
        monthlyResultsHtml += `<tr>
            <td class="text-center">${index + 1}</td>
            <td>${currencyFormat(item.startBalance)}</td>
            <td>${currencyFormat(item.interestPayment)}</td>
            <td>${currencyFormat(item.withdrawal)}</td>
            <td>${currencyFormat(item.endBalance)}</td>
        </tr>`;

        if ((index + 1) % 12 === 0 || (index + 1) === monthlyResults.length) {
            const year = Math.ceil((index + 1) / 12);
            const title = `Year #${year} End`;
            monthlyResultsHtml += `<th class="white text-center" colspan="6">${title}</th>`;
        }
    });

    $monthlyResultsTable.innerHTML = monthlyResultsHtml;
}

/**
 * @param {ResultList} annualResults
 * @param {Chart} primaryChart
 */
const displayPrimaryResultsChart = (annualResults, primaryChart) => {
    primaryChart.data.labels = annualResults.map((_, idx) => idx + 1);
    primaryChart.data.datasets[0].data = annualResults.map(it => it.endBalance);
    primaryChart.data.datasets[1].data = annualResults.map(it => it.totalInterest);
    primaryChart.data.datasets[2].data = annualResults.map(it => it.totalWithdrawn);

    primaryChart.reset();
    primaryChart.update();
}

const calculateInputs = () => {
    const calcTypeIndex = $calculationType.selectedIndex;
    const calcFunc = getCalcFuncFromIndex(calcTypeIndex);
    const {
        $startingPrincipal,
        $annuityTerm,
        $interestRate,
        $compound,
        $monthlyIncome,
        $annualIncrease
    } = calcInputs[calcTypeIndex];

    input.reset();
    const principal = input.get($startingPrincipal?.id).val();
    const annuityTerm = input.get($annuityTerm?.id).val();
    const interestRate = input.get($interestRate?.id).val();
    const compoundIdx = input.get($compound?.id).index().val();
    const monthlyIncome = input.get($monthlyIncome?.id).val();
    const annualIncrease = input.get($annualIncrease?.id).val();

    const compound = getCompoundFromIndex(compoundIdx);

    if (!input.valid()) throw new Error("Invalid State");

    console.warn("Calculate called: ", principal, annuityTerm, interestRate, compound, monthlyIncome, annualIncrease);

    const {
        outputResults: {
            main,
            smallA,
            smallB,
            smallC
        },
        calculationResults
    } = calcFunc(
        principal,
        annuityTerm,
        interestRate,
        compound,
        monthlyIncome,
        annualIncrease
    );

    const {
        $main,
        $smallA,
        $smallB,
        $smallC
    } = calcOutputs[calcTypeIndex];

    $main && ($main.innerHTML = main);
    $smallA && ($smallA.innerHTML = smallA);
    $smallB && ($smallB.innerHTML = smallB);
    $smallC && ($smallC.innerHTML = smallC)

    return calculationResults;
}

/**
 * @param {Chart} primaryChart
 */
const runApp = (primaryChart) => {
    const monthlyResults = calculateInputs();
    const annualResults = getAnnualResults(monthlyResults);

    displayMonthlyResultsTable(monthlyResults);
    displayAnnualResultsTable(annualResults);
    displayPrimaryResultsChart(annualResults, primaryChart);
}

$calculationType.addEventListener('change', toggleRelatedInputs);

Object.values(calcInputs).forEach(({
    $startingPrincipal,
    $annuityTerm,
    $interestRate,
    $monthlyIncome,
    $annualIncrease,
}) => {
    [
        $startingPrincipal,
        $annuityTerm,
        $interestRate,
        $monthlyIncome,
        $annualIncrease,
    ].forEach(input => input?.addEventListener('input', forceNumeric));
});

import("./lib/chartjs/chart.js").then(({ Chart, registerables }) => {
    Chart.register(...registerables);

    const primaryChart = new Chart($primaryChart, {
        type: 'line',
        data: primaryChartData,
        options: {
            response: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: tooltip,
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    stacked: true,
                    ticks: {
                        callback: (it) => currencyFormat(it, ' '),
                    },
                },
                x: {
                    stacked: true,
                    ticks: {
                        callback: function (value, index, ticks) {
                            return value + 1;
                        }
                    },
                    grid: {
                        display: false
                    },
                },
            },
        }
    });

    $calculationType.addEventListener('change', () => runApp(primaryChart));
    $calculateBtn.addEventListener('click', () => runApp(primaryChart));

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    if (urlParams.has('type')) {
        const event = new Event('change');
        $calculationType.dispatchEvent(event);
    }
})
