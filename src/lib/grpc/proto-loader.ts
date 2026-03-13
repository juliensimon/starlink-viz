import * as path from 'path';
import * as protoLoader from '@grpc/proto-loader';
import * as grpc from '@grpc/grpc-js';

const PROTO_PATH = path.join(process.cwd(), 'src/lib/grpc/dish.proto');

export async function loadDishProto(): Promise<grpc.GrpcObject | null> {
  try {
    const packageDefinition = await protoLoader.load(PROTO_PATH, {
      keepCase: false,
      longs: Number,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    return grpc.loadPackageDefinition(packageDefinition);
  } catch (err) {
    console.error('Failed to load dish proto:', err);
    return null;
  }
}
