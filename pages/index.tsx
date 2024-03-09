import {
  PublicKey,
  publicKey,
  Umi,
} from "@metaplex-foundation/umi";
import { DigitalAssetWithToken, JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import dynamic from "next/dynamic";
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { useUmi } from "../utils/useUmi";
import { fetchCandyMachine, safeFetchCandyGuard, CandyGuard, CandyMachine, AccountVersion } from "@metaplex-foundation/mpl-candy-machine"
import styles from "../styles/Home.module.css";
import { guardChecker } from "../utils/checkAllowed";
import { Center, Card, CardHeader, CardBody, StackDivider, Heading, Stack, useToast, Text, Skeleton, useDisclosure, Button, Modal, ModalBody, ModalCloseButton, ModalContent, Image, ModalHeader, ModalOverlay, Box, Divider, VStack, Flex } from '@chakra-ui/react';
import { ButtonList } from "../components/mintButton";
import { GuardReturn } from "../utils/checkerHelper";
import { ShowNft } from "../components/showNft";
import { InitializeModal } from "../components/initializeModal";
import { image, headerText } from "../settings";
import { useSolanaTime } from "@/utils/SolanaTimeContext";
import { log } from "console";
import { stringify } from "querystring";
import { NextResponse } from "next/server";



const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const useCandyMachine = (
  umi: Umi,
  candyMachineId: string,
  checkEligibility: boolean,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>,
  firstRun: boolean,
  setfirstRun: Dispatch<SetStateAction<boolean>>
) => {
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const [candyGuard, setCandyGuard] = useState<CandyGuard>();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      if (checkEligibility) {
        if (!candyMachineId) {
          console.error("No candy machine in .env!");
          if (!toast.isActive("no-cm")) {
            toast({
              id: "no-cm",
              title: "No candy machine in .env!",
              description: "Add your candy machine address to the .env file!",
              status: "error",
              duration: 999999,
              isClosable: true,
            });
          }
          return;
        }

        let candyMachine;
        try {
          candyMachine = await fetchCandyMachine(umi, publicKey(candyMachineId));
          //verify CM Version
          if (candyMachine.version != AccountVersion.V2) {
            toast({
              id: "wrong-account-version",
              title: "Wrong candy machine account version!",
              description: "Please use latest sugar to create your candy machine. Need Account Version 2!",
              status: "error",
              duration: 999999,
              isClosable: true,
            });
            return;
          }
        } catch (e) {
          console.error(e);
          toast({
            id: "no-cm-found",
            title: "The CM from .env is invalid",
            description: "Are you using the correct environment?",
            status: "error",
            duration: 999999,
            isClosable: true,
          });
        }
        setCandyMachine(candyMachine);
        if (!candyMachine) {
          return;
        }
        let candyGuard;
        try {
          candyGuard = await safeFetchCandyGuard(umi, candyMachine.mintAuthority);
        } catch (e) {
          console.error(e);
          toast({
            id: "no-guard-found",
            title: "No Candy Guard found!",
            description: "Do you have one assigned?",
            status: "error",
            duration: 999999,
            isClosable: true,
          });
        }
        if (!candyGuard) {
          return;
        }
        setCandyGuard(candyGuard);
        if (firstRun) {
          setfirstRun(false)
        }
      }
    })();
  }, [umi, checkEligibility]);

  return { candyMachine, candyGuard };


};


export default function Home() {
  const umi = useUmi();
  const solanaTime = useSolanaTime();
  const toast = useToast();
  const { isOpen: isShowNftOpen, onOpen: onShowNftOpen, onClose: onShowNftClose } = useDisclosure();
  const { isOpen: isInitializerOpen, onOpen: onInitializerOpen, onClose: onInitializerClose } = useDisclosure();
  const [mintsCreated, setMintsCreated] = useState<{ mint: PublicKey, offChainMetadata: JsonMetadata | undefined }[] | undefined>();
  const [isAllowed, setIsAllowed] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [ownedTokens, setOwnedTokens] = useState<DigitalAssetWithToken[]>();
  const [guards, setGuards] = useState<GuardReturn[]>([
    { label: "startDefault", allowed: false, maxAmount: 0 },
  ]);
  const [firstRun, setFirstRun] = useState(true);
  const [checkEligibility, setCheckEligibility] = useState<boolean>(true);


  const [successModal, setSuccessModal] = useState(false)
  const [errorModal, setErrorModal] = useState(false)


  if (!process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
    console.error("No candy machine in .env!")
    if (!toast.isActive('no-cm')) {
      toast({
        id: 'no-cm',
        title: 'No candy machine in .env!',
        description: "Add your candy machine address to the .env file!",
        status: 'error',
        duration: 999999,
        isClosable: true,
      })
    }
  }
  const candyMachineId: PublicKey = useMemo(() => {
    if (process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
      return publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
    } else {
      console.error(`NO CANDY MACHINE IN .env FILE DEFINED!`);
      toast({
        id: 'no-cm',
        title: 'No candy machine in .env!',
        description: "Add your candy machine address to the .env file!",
        status: 'error',
        duration: 999999,
        isClosable: true,
      })
      return publicKey("11111111111111111111111111111111");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { candyMachine, candyGuard } = useCandyMachine(umi, candyMachineId, checkEligibility, setCheckEligibility, firstRun, setFirstRun);

  useEffect(() => {
    const checkEligibilityFunc = async () => {
      if (!candyMachine || !candyGuard || !checkEligibility || isShowNftOpen) {
        return;
      }
      setFirstRun(false);

      const { guardReturn, ownedTokens } = await guardChecker(
        umi, candyGuard, candyMachine, solanaTime
      );

      setOwnedTokens(ownedTokens);
      setGuards(guardReturn);
      setIsAllowed(false);

      let allowed = false;
      for (const guard of guardReturn) {
        if (guard.allowed) {
          allowed = true;
          break;
        }
      }

      setIsAllowed(allowed);
      setLoading(false);
    };

    checkEligibilityFunc();
    // On purpose: not check for candyMachine, candyGuard, solanaTime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [umi, checkEligibility, firstRun]);


  async function postWallet(wallet: string) {
    const res = await fetch('https://apiwallets.onrender.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 'wallet': wallet }),
    })

    const data = await res.text();

    if (data == 'Success') {
      setSuccessModal(true)
    }

    if (data == 'Error, duplicate wallets') {
      setErrorModal(true)
    }

  }

  const PageContent = () => {
    return (
      <>
        <style jsx global>
          {`
      body {
          background: #62B681; 
       }
   `}
        </style>
        <section style={{ padding: 23, background: 'white', display: 'flex', justifyContent: 'center', flexDirection: 'column', borderRadius: 10 }}>

          <h1 style={{ fontSize: 24, fontWeight: 700 }}>
            Participate NOW on UNIC Airdrop!
          </h1>

          <div style={{ padding: 23, background: 'white', display: 'flex', textAlign: 'center', justifyContent: 'center' }}>
            <Image src="https://arweave.net/e8t46kU_kTj1YlToQJhP3m-aPGRlCnBUCPg3069dDZ0" width={200} alt="UNIC Icon"></Image>
          </div>
          {
            umi.identity.publicKey !== '11111111111111111111111111111111' ?
              <button
                onClick={() => postWallet(umi.identity.publicKey)}
                style={{ padding: 15, background: '#62B681', display: 'flex', textAlign: 'center', justifyContent: 'center', borderRadius: 10, fontWeight: 700, fontSize: 24 }}>
                PARTICIPATE NOW
              </button>
              :
              <button style={{ padding: 15, background: '#62B681', display: 'flex', textAlign: 'center', justifyContent: 'center', borderRadius: 10, fontWeight: 700, fontSize: 24 }}>
                Connect your wallet
              </button>
          }
        </section >


        <Modal isOpen={successModal} onClose={onShowNftClose} >
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>✅️ Congratulations, you participated for the UNIC airdrop!</ModalHeader>
            {/* <ModalCloseButton /> */}

            <ModalBody>
              Follow us on our social network to know all the updates about the project!

              <div style={{ display: 'flex', marginTop: 22, marginBottom: 12, gap: 12, fontWeight: 700 }}>
                <a href="https://twitter.com/Unicoinia">Twitter</a>
                <a href="https://discord.com/invite/jVwWVXDkDD">Discord</a>
                <a href="https://www.instagram.com/unicoinia/">Instagram</a>
              </div>
            </ModalBody>

          </ModalContent>
        </Modal >

        <Modal isOpen={errorModal} onClose={onShowNftClose} >
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>🛑 Error, your wallet is already participating!</ModalHeader>
            {/* <ModalCloseButton /> */}
            <ModalBody>
              Follow us on our social network to know all the updates about the project!

              <div style={{ display: 'flex', marginTop: 22, marginBottom: 12, gap: 12, fontWeight: 700 }}>
                <a href="https://twitter.com/Unicoinia">Twitter</a>
                <a href="https://discord.com/invite/jVwWVXDkDD">Discord</a>
                <a href="https://www.instagram.com/unicoinia/">Instagram</a>
              </div>
            </ModalBody>
          </ModalContent>
        </Modal >
      </>
    );
  };

  return (
    <main>
      <div className={styles.wallet}>
        <WalletMultiButtonDynamic />
      </div>

      <div className={styles.center}>
        <PageContent key="content" />
      </div>
    </main>
  );
}
