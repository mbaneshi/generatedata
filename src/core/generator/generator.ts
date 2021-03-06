/**
 * Our generator. This does the work of passing off the work off to the selected plugins and piecing the
 * generated data for returning to the client.
 */
import { getStrings } from '~utils/langUtils';
import { GenerationProps, GenerationTemplate, GenerationTemplateRow } from '~types/general';
import { DTGenerateResult, DTGenerationExistingRowData } from '~types/dataTypes';

// data: ExportTypeGenerateType
export const generate = (data: GenerationProps): string => {
	// const generationContext = {
	// 	environment: 'UI'
	// };

	// here we offload the generated data to the Export Type
	// const { content } = JSON.generate('UI', tmpExportTypeSettings, {
	// 	data,
	// 	generateExportData
	// });

	return '';
};

// TODO TEST EVERY LAST PART OF THIS
export const generatePreviewData = (data: GenerationProps): Promise<any> => {
	return new Promise((resolve) => {
		const generationTemplate = data.template;
		const i18n = getStrings();

		// for the preview panel we always generate the max num of preview panel rows so when the user changes the
		// visible rows the data's already there
		const lastRowNum = data.numResults;
		const rowPromises = [];

		// rows are independent! The only necessarily synchronous bit is between process batches
		for (let rowNum=1; rowNum<=lastRowNum; rowNum++) {
			const currRowData: DTGenerationExistingRowData[] = [];
			rowPromises.push(processBatchSequence(generationTemplate, rowNum, i18n, currRowData));
		}

		Promise.all(rowPromises)
			.then((data) => {
				resolve(data);
			});
	});
};

const processBatchSequence = (generationTemplate: GenerationTemplate, rowNum: number, i18n: any, currRowData: DTGenerationExistingRowData[]) => {
	return new Promise((resolveAll) => {
		let sequence = Promise.resolve();
		const processBatches = Object.keys(generationTemplate);

		// process each batch sequentially. This ensures the data generated from one processing batch is available to any
		// dependent children. For example, the Region data type needs the Country data being generated first so it
		// knows what country regions to generate if a mapping had been selected in the UI
		processBatches
			.forEach((processBatch: string, batchIndex: number) => {
				const processBatchNum = parseInt(processBatch, 10);
				const currBatch = generationTemplate[processBatchNum];

				// yup. We're mutating the currRowData param on each loop. We don't care hhahaha!!! Up yours, linter!
				sequence = sequence
					.then(() => processDataTypeBatch(currBatch, rowNum, i18n, currRowData))
					.then((promises) => {
						// console.log(`Batch ${processBatchNum} processed`);

						return new Promise((resolveBatch) => {
							Promise.all(promises)
								.then((generatedData) => {
									generatedData.forEach((data, index) => {
										const { id, colIndex, dataType } = currBatch[index];
										currRowData.push({
											id,
											colIndex,
											dataType,
											data: data as DTGenerateResult
										});
									});
									resolveBatch();

									if (batchIndex === processBatches.length-1) {
										currRowData.sort((a: DTGenerationExistingRowData, b: DTGenerationExistingRowData): any => a.colIndex < b.colIndex ? -1 : 1);
										resolveAll(currRowData.map((row) => row.data.display));
									}
								});
						});
					});
			});
	});
};


// Data Type generate() functions can be sync or async, depending on their needs. This method calls the generation
// method for all data types in a particular process batch and returns an array of promises, which when resolved,
// return the generated data for that row
export const processDataTypeBatch = (cells: GenerationTemplateRow[], rowNum: number, i18n: any, currRowData: any[]): any => (
	cells.map((currCell) => {
		const response = currCell.generateFunc({
			rowNum,
			i18n: i18n.dataTypes[currCell.dataType],
			countryI18n: i18n.countries,
			rowState: currCell.rowState,
			existingRowData: currRowData
		});

		if (typeof response.then === 'function') {
			return response;
		} else {
			return Promise.resolve(response);
		}
	})
);

