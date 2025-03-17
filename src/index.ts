require("dotenv").config();

import * as Fs from "fs";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

import { searcher, bundle } from "jito-ts";
import { SystemProgram } from "@solana/web3.js";

const getRandomeTipAccountAddress = async (
  searcherClient: searcher.SearcherClient,
) => {
  const account = await searcherClient.getTipAccounts();
  if (account.ok) {
    const addresses = account.value; // Extract the array from the Result
    return new PublicKey(addresses[Math.floor(Math.random() * addresses.length)]);
  } else {
    throw new Error(`Failed to fetch tip accounts: ${account.error.message}`);
  }
  
};

export const onBundleResult = (c: searcher.SearcherClient): Promise<number> => {
  let first = 0;
  let isResolved = false;

  return new Promise((resolve) => {
    // Set a timeout to reject the promise if no bundle is accepted within 5 seconds
    setTimeout(() => {
      console.log("222")
      resolve(first);
      isResolved = true;
    }, 30000);

    console.log("Setting up onBundleResult listener...");

c.onBundleResult(
  (result: any) => {
    console.log("111"); // Debugging log
    if (isResolved) return;
    console.log("Received result:", result);

    const isAccepted = result.accepted;
    const isRejected = result.rejected;

    if (!isResolved) {
      if (isAccepted) {
        first += 1;
        isResolved = true;
        console.log("Final result (Accepted):", result);
        resolve(first);
      }
      if (isRejected) {
        console.log("Bundle was rejected");
      }
    }
  },
  (e: any) => {
    console.error("Error in onBundleResult:", e);
  }
);

  });
};




const main = async () => {
  const blockEngineUrl = process.env.BLOCK_ENGINE_URL || "";
  console.log("BLOCK_ENGINE_URL:", blockEngineUrl);

 
  const keypair = Keypair.fromSecretKey(bs58.decode(""));

  const bundleTransactionLimit = parseInt(
    process.env.BUNDLE_TRANSACTION_LIMIT || "5",
  );

  

  // Create the searcher client that will interact with Jito
  const searcherClient = searcher.searcherClient(blockEngineUrl);

  searcherClient.onBundleResult(
    (result) => {
      console.log("received bundle result:", result);
    },
    (e) => {
      throw e;
    },
  );
  
  // Get a random tip account address
  const tipAccount = await getRandomeTipAccountAddress(searcherClient);
  console.log("tip account:", tipAccount.toBase58());

  const rpcUrl = process.env.RPC_URL || "";
  console.log("RPC_URL:", rpcUrl);

  // get the latest blockhash
  const connection = new Connection(rpcUrl, "confirmed");

  // Build and sign a tip transaction
  const transfer1Ix = SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: new PublicKey("CMfPj4buBfD4XEuDa6NHHL3FHbXTaUWwe7K52YmcjaLn"),
    lamports: 1000000, // tip amount
  });
  const transfer2Ix = SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: new PublicKey("DfHhcLw2yX9i3bTtA7CU9XTE2fsNTH4VSi1GeRMdcyEK"),
    lamports: 1000000, // tip amount
  });
  const tipIx = SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: tipAccount,
    lamports: 1000000, // tip amount
  });
  const transfer1Tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: (
        await connection.getLatestBlockhash()
      ).blockhash,
      instructions: [transfer1Ix],
    }).compileToV0Message(),
  );
  transfer1Tx.sign([keypair]);
  const transfer2Tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: (
        await connection.getLatestBlockhash()
      ).blockhash,
      instructions: [transfer2Ix],
    }).compileToV0Message(),
  );
  transfer2Tx.sign([keypair]);
  const tipTx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: (
        await connection.getLatestBlockhash()
      ).blockhash,
      instructions: [tipIx],
    }).compileToV0Message(),
  );
  tipTx.sign([keypair]);

  const transactions = [
    transfer1Tx,
    transfer2Tx,
    tipTx,
  ];


  const jitoBundle = new bundle.Bundle(
    transactions,
    bundleTransactionLimit,
  );

  try {
    const resp = await searcherClient.sendBundle(jitoBundle);
    console.log("resp:", resp);
    // const bundleResult = await onBundleResult(searcherClient);
    // console.log("bundleResult:", bundleResult);
  } catch (e) {
    console.error("error sending bundle:", e);
  }
  
};

main()
  
  .catch((e) => {
    throw e;
  });
