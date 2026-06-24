import sharp from "sharp";
import type {
  ImageInfo,
  ImageProcessor,
  ProcessedRendition,
  RenditionSpec,
} from "./types.js";

export class SharpImageProcessor implements ImageProcessor {
  async inspect(input: Buffer): Promise<ImageInfo> {
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height || !meta.format) {
      throw new Error("Unable to read image metadata");
    }
    return {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      sizeBytes: input.byteLength,
    };
  }

  async process(
    input: Buffer,
    specs: RenditionSpec[],
  ): Promise<ProcessedRendition[]> {
    const source = await this.inspect(input);
    return Promise.all(specs.map((spec) => this.processOne(input, source, spec)));
  }

  private async processOne(
    input: Buffer,
    source: ImageInfo,
    spec: RenditionSpec,
  ): Promise<ProcessedRendition> {
    if (spec.format === "original") {
      return {
        name: spec.name,
        data: input,
        width: source.width,
        height: source.height,
        format: source.format,
        sizeBytes: input.byteLength,
      };
    }

    let pipeline = sharp(input);
    if (spec.maxDimension !== undefined) {
      pipeline = pipeline.resize({
        width: spec.maxDimension,
        height: spec.maxDimension,
        fit: spec.fit,
        withoutEnlargement: true,
      });
    }
    pipeline = pipeline.webp({ quality: spec.quality ?? 82 });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return {
      name: spec.name,
      data,
      width: info.width,
      height: info.height,
      format: info.format,
      sizeBytes: data.byteLength,
    };
  }
}
