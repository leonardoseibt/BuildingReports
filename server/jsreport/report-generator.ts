import type { Readable } from 'node:stream';

import { buildReportRenderData } from '../puppeteer/report-generator';



let jsreportInstancePromise: Promise<any> | null = null;



async function getJsReportInstance() {

  if (!jsreportInstancePromise) {

    jsreportInstancePromise = (async () => {

      const mod = await import('jsreport');

      const factory = (mod as any)?.default ?? (mod as any);

      const instance = factory({

        trustUserCode: false,

        loadConfig: false,

        allowLocalFilesAccess: true,

        reportTimeout: 120000,

        extensions: {

          express: { enabled: false }

        },

        chrome: {

          strategy: 'chrome-pool',

          numberOfWorkers: 1,

          launchOptions: {

            args: ['--no-sandbox', '--disable-setuid-sandbox']

          }

        }

      });

      await instance.init();

      return instance;

    })();

  }

  return jsreportInstancePromise;

}



async function streamToBuffer(stream: Readable): Promise<Buffer> {

  const chunks: Buffer[] = [];

  for await (const chunk of stream) {

    if (chunk == null) continue;

    if (typeof chunk === 'string') {

      chunks.push(Buffer.from(chunk, 'utf-8'));

    } else if (Buffer.isBuffer(chunk)) {

      chunks.push(chunk);

    } else if (chunk instanceof Uint8Array) {

      chunks.push(Buffer.from(chunk));

    } else if (typeof chunk === 'number') {

      chunks.push(Buffer.from([chunk]));

    } else if (Array.isArray(chunk) && chunk.every((value) => typeof value === 'number')) {

      chunks.push(Buffer.from(chunk));

    } else if (typeof chunk === 'object' && typeof (chunk as any).valueOf === 'function') {

      const value = (chunk as any).valueOf();

      if (typeof value === 'number') {

        chunks.push(Buffer.from([value]));

        continue;

      }

      if (Buffer.isBuffer(value)) {

        chunks.push(value);

        continue;

      }

    } else if ((chunk as any)?.pipe) {

      chunks.push(await streamToBuffer(chunk as unknown as Readable));

      continue;

    } else {

      chunks.push(Buffer.from(String(chunk)));

    }

  }

  return Buffer.concat(chunks);

}



export async function generateReportPdfJsreport(reportId: number, userId: number): Promise<{ filename: string; pdf: Buffer }> {

  const { html, filename } = await buildReportRenderData(reportId, userId);

  const instance = await getJsReportInstance();



  const commonTimeout = 120000;

  const result = await instance.render({

    template: {

      content: html,

      engine: 'none',

      recipe: 'chrome-pdf',

      chrome: {

        printBackground: true,

        waitForNetworkIdle: true,

        timeout: commonTimeout,

        marginTop: '18mm',

        marginBottom: '15mm',

        marginLeft: '10mm',

        marginRight: '8mm',

        launchOptions: {

          args: ['--no-sandbox', '--disable-setuid-sandbox']

        }

      }

    },

    timeout: commonTimeout

  });



  const content = result.content as Readable | Buffer | Uint8Array | string | null | undefined;

  let pdf: Buffer;

  if (Buffer.isBuffer(content)) {

    pdf = content;

  } else if (content instanceof Uint8Array) {

    pdf = Buffer.from(content);

  } else if (typeof content === 'string') {

    pdf = Buffer.from(content, 'utf-8');

  } else if (Array.isArray(content) && await content.every((value) => typeof value === 'number')) {

    pdf = Buffer.from(content);

  } else if (content && typeof (content as any).pipe === 'function') {

    const stream = content as Readable;

    pdf = await streamToBuffer(stream);

    if (typeof (stream as any)?.destroy === 'function') {

      try {

        (stream as any).destroy();

      } catch {

        // ignore stream cleanup errors

      }

    }

  } else if (content == null) {

    pdf = Buffer.alloc(0);

  } else {

    pdf = Buffer.from(String(content));

  }

  return { filename, pdf };

}

