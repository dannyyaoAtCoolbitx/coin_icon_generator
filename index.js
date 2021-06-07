const fs = require('fs');
const fsPromise = require('fs').promises;
const githubContent = require('github-content');
const { scale } = require('scale-that-svg');
const { svg2png } = require("svg-png-converter")
// const svg2png = require("svg2png");
// Paths
const SYMBOL_FILE_PATH = process.argv[2] || './input/symbols.json';
const OUTPUT_PATH = process.argv[3] || './output';
// Sources of icon
const options = {
    owner: 'spothq',
    repo: 'cryptocurrency-icons',
    branch: 'master'
};  
const gc = new githubContent(options);
// global variable storing all svg for rn;
const outputForRN = {};
// Filenames
const RN_FILE_NAME = 'icons.json';
const OUTPUT_IOS = [
    {size: 120, postfix: ""},
    {size: 240, postfix: "@2x"},
    {size: 360, postfix: "@3x"},
];
const OUTPUT_ANDROID = [
    {size: 30, folderName: "hdpi"},
    {size: 45, folderName: "mdpi"},
    {size: 60, folderName: "xhdpi"},
    {size: 90, folderName: "xxhdpi"},
    {size: 120, folderName: "xxxhdpi"},
];
// onlineSourceScaling
const ORIGINAL_SIZE = 32;
const OUR_SIZE = 120;
const ONLINE_SOURCE_SCALING = OUR_SIZE/ORIGINAL_SIZE;

const resizeSvg = async (svgBuffer, scaling) => {
    const resized = await scale(svgBuffer, { scale: scaling })
    return resized;
}

const storePngFile = async (svgBuffer, size, outputFolder, outputName) => {
    await createFolder(outputFolder);
    const outputFilePath = `${outputFolder}/${outputName}`;
    const scaling = size/ORIGINAL_SIZE;
    const resized = await resizeSvg(svgBuffer, scaling);
    const base64Image = await svg2png({ 
        input: resized.trim(),
        encoding: 'dataURL', 
        format: 'png',
        width: size,
        height: size,
        // multiplier: 1
    });
    var base64Data = base64Image.replace(/^data:image\/png;base64,/, "");
    await fsPromise.writeFile(outputFilePath, base64Data, 'base64');
    return true;
}

const parseOriginalSvg = (svgBuffer, symbol) => {
    return new Promise( async (resolve, reject) => {
        const resizedSvg = await resizeSvg(svgBuffer, ONLINE_SOURCE_SCALING);
        const svgFilePath = `${OUTPUT_PATH}/Android svg/coins/coin_${symbol}.svg`;
        outputForRN[symbol] = resizedSvg;
        await fsPromise.writeFile(svgFilePath, resizedSvg);
        return resolve(svgFilePath);
    })
}

const parseIcon = (symbol) => {
    return new Promise((resolve, reject)=>{
        gc.file(`/svg/icon/${symbol.toLowerCase()}.svg`, async (err, file)=>{
            if(err){
                return resolve(false);
            }else{
                const svgBuffer = file.contents;
                await parseOriginalSvg(svgBuffer, symbol);
                // ios
                for(let i in OUTPUT_IOS){
                    await storePngFile(svgBuffer, OUTPUT_IOS[i]['size'], `${OUTPUT_PATH}/iOS/${symbol}`, `${symbol}${OUTPUT_IOS[i]['postfix']}.png`);
                }
                // android
                await createFolder(`${OUTPUT_PATH}/Android png/${symbol}`);
                for(let j in OUTPUT_ANDROID){
                    await storePngFile(svgBuffer, OUTPUT_ANDROID[j]['size'], `${OUTPUT_PATH}/Android png/${symbol}/${OUTPUT_ANDROID[j]['folderName']}`, `coin_${symbol}.png`);
                }
                return resolve(true);
            }
        })
    })
}

const createFolder = async (dir) => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    return true;
}

const storeJsonFileForRN = async () => {
    await fsPromise.writeFile(`${OUTPUT_PATH}/RN/${RN_FILE_NAME}`, outputForRN);
    return true;
}

const prepareBasicFolders = async () => {
    await createFolder(`${OUTPUT_PATH}`);
    await createFolder(`${OUTPUT_PATH}/Android svg`);
    await createFolder(`${OUTPUT_PATH}/Android svg/coins`);
    await createFolder(`${OUTPUT_PATH}/Android png`);
    await createFolder(`${OUTPUT_PATH}/iOS`);
    await createFolder(`${OUTPUT_PATH}/RN`);
    return true;
}

const mainTask = async () => {
    const iconNotConverted = [];
    const content = await fsPromise.readFile(SYMBOL_FILE_PATH, "utf-8");
    const symbols = JSON.parse(content);
    await prepareBasicFolders()
    for(let i in symbols){
        console.log(`Parsing ${symbols[i]}...`)
        const parsed = await parseIcon(symbols[i]);
        if(!parsed){
            console.log(`Can find resource for ${symbols[i]}.`)
            iconNotConverted.push(symbols[i])
        }else{
            console.log(`${symbols[i]} Parsed.`)
        }
    }
    await storeJsonFileForRN()
    console.log({iconNotConverted})
}


mainTask()