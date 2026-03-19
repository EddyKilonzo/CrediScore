import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../../ai/ai.service';
import { QUEUES, JOB_NAMES } from '../queue.constants';
import { DocumentProcessingJobData } from '../queue.service';

@Processor(QUEUES.DOCUMENT_PROCESSING)
export class DocumentProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {
    super();
  }

  async process(job: Job<DocumentProcessingJobData>): Promise<void> {
    const { documentId, documentUrl, documentType, correlationId } = job.data;
    const tag = `[${correlationId}][Job:${job.id}]`;

    if (job.name !== JOB_NAMES.PROCESS_DOCUMENT) return;

    this.logger.log(`${tag} Processing document ${documentId} (${documentType})`);

    try {
      const ocrResult = await this.aiService.extractTextFromImage(documentUrl);

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          ocrText: ocrResult,
          ocrConfidence: ocrResult ? 85 : 0,
          aiVerified: false,
          aiVerifiedAt: new Date(),
        },
      });

      this.logger.log(
        `${tag} Document ${documentId} OCR complete — ${ocrResult?.length ?? 0} chars extracted`,
      );
    } catch (error) {
      this.logger.error(`${tag} Document processing failed: ${(error as Error).message}`);
      throw error;
    }
  }
}
