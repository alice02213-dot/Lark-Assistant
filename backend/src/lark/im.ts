import larkClient from "./client";

export type ReceiveIdType = "user_id" | "open_id" | "union_id" | "email" | "chat_id";

export async function sendTextMessage(
  receiveId: string,
  text: string,
  receiveIdType: ReceiveIdType = "open_id"
): Promise<void> {
  await larkClient.post(
    `/im/v1/messages?receive_id_type=${receiveIdType}`,
    {
      receive_id: receiveId,
      msg_type: "text",
      // content MUST be a JSON-serialised string, not a nested object
      content: JSON.stringify({ text }),
    }
  );
}
