import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { ethers } from 'ethers';
//import tokenJson directly to avoid the abi error, not import * as tokenJson
//import * as MyTokenJson from '../assets/MyToken.json';
import tokenJson from '../assets/MyToken.json';
import ballotJson from '../assets/Ballot.json';
import { AlchemyProvider } from '@ethersproject/providers';
//const tokenJson = MyTokenJson;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  provider: ethers.providers.Provider;
  wallet: ethers.Wallet | undefined;
  ballotContract: ethers.Contract | undefined;
  tokenContract: ethers.Contract | undefined;
  etherBalance: number | undefined;
  tokenBalance: number | undefined;
  votePower: number | undefined;
  tokenAddress: string | undefined;
  ballotProposals: [] | undefined;
  ballotProposalsDisplay:
    | [
        {
          idx: string;
          name: string;
          voteCount: string;
          isWinning: string;
        }
      ]
    | undefined;
  voteTransactionHash: string | undefined;

  constructor(private http: HttpClient) {
    //http is injected in constructor and is available in all fns
    this.provider = ethers.providers.getDefaultProvider('goerli');
  }

  createWallet() {
    //this is not a promise, it is an observabel so cannot be awaited. Can subscribe
    //  instead of await
    this.http
      .get<any>('http://localhost:3000/token-address')
      .subscribe((ans) => {
        this.tokenAddress = ans.result;
        const unconnectedWallet = ethers.Wallet.createRandom();
        this.updateContractInfoForWallet(unconnectedWallet);
      });
  }

  importWallet(walletPrivateKey: string) {
    this.http
      .get<any>('http://localhost:3000/token-address')
      .subscribe((ans) => {
        this.tokenAddress = ans.result;
        if (walletPrivateKey) {
          const unconnectedWallet = new ethers.Wallet(walletPrivateKey);
          this.updateContractInfoForWallet(unconnectedWallet);
        }
      });
  }

  private updateContractInfoForWallet(unconnectedWallet: ethers.Wallet) {
    //if the address isn't null, do the wallet, contract, update
    if (this.tokenAddress) {
      this.wallet = unconnectedWallet.connect(this.provider);
      this.tokenContract = new ethers.Contract(
        this.tokenAddress,
        tokenJson.abi,
        this.wallet
      );
      this.updateInfo();
    }
  }

  /**If the wallet and contract are already set we can update the display for
   * everything.
   * However if the contract isn't set but the wallet is, we can still update
   * the display of the wallet's balance.
   */
  private updateInfo() {
    if (this.wallet) {
      this.wallet.getBalance().then((balanceBN: ethers.BigNumberish) => {
        //casting it to a number works like parseFloat: Matheus reckons parseFloat is safer
        //this.etherBalance = Number(ethers.utils.formatEther(balanceBN))
        this.etherBalance = parseFloat(ethers.utils.formatEther(balanceBN));
      });
      if (this.tokenContract) {
        this.tokenContract['balanceOf'](this.wallet.address).then(
          (balanceBN: ethers.BigNumberish) => {
            this.tokenBalance = parseFloat(ethers.utils.formatEther(balanceBN));
          }
        );
        
        if (this.ballotContract) {
          this.ballotContract['votePower'](this.wallet.address).then(
            (votePowerBN: ethers.BigNumberish) => {
              this.votePower = parseFloat(ethers.utils.formatEther(votePowerBN));
            }
          );
        }
      }
    } else {
      console.log('In updateInfo, this.wallet is unset');
    }
  }

  //TODO await for this transaction to be completed
  claimTokens() {
    console.log('wallet addr is: ' + this.wallet?.address);
    this.http
      .post<any>('http://localhost:3000/claim-tokens', {
        address: this.wallet?.address,
      })
      .subscribe((ans) => {
        //console.log({ans});
        //TODO await for this transaction to be completed.
        //This will be a tx hash
        const txHash = ans.result;

        this.provider.getTransaction(txHash).then((tx) => {
          tx.wait().then((txReceipt) => {
            //TODO (optional) Display the update info.
            //reload info by calling the updateInfo etc again.
            this.updateInfo();
          });
        });
      });
  }

  connectBallot(ballotContractAddress: string) {
    
    if (ballotContractAddress && this.wallet) {
      this.ballotContract = new ethers.Contract(
        ballotContractAddress,
        ballotJson.abi,
        this.wallet
      );
    }
    this.getballotInfo(ballotContractAddress);
    this.updateInfo();
  }

  delegateVote(delegateeAddress: string) {
    this.http
      .post<any>('http://localhost:3000/delegate-vote', {
        address: delegateeAddress,
      })
      .subscribe((ans) => {
        this.updateInfo();
      });
  }

  castVote(proposalNumber: string, voteAmount: string) {
    this.http
      .post<any>('http://localhost:3000/cast-vote', {
        proposalNumber,
        voteAmount,
      })
      .subscribe((ans) => {
        console.log(ans.result);
        this.voteTransactionHash = ans.result;
      });
  }

  getballotInfo(ballotContractAddress: string) {
    this.http
      .post<any>('http://localhost:3000/connect-ballot', {
        address: ballotContractAddress,
      })
      .subscribe((ans) => {
        this.ballotProposals = ans.result;
        //create the array with an empty type so it's not undefined. 
        //Then pop the empty type, so that we don't have a blank one in the array.
        this.ballotProposalsDisplay = [
          {
            idx: "",
            name: "",
            voteCount: "",
            isWinning: "",
          },
        ];
        this.ballotProposalsDisplay.pop();
        this.ballotProposals?.map((proposal, i) => {
          const idx = ethers.BigNumber.from(proposal[0]).toString();
          let name = ethers.utils.parseBytes32String(proposal[1]);
          const voteCount = ethers.utils.formatEther(proposal[2]).toString();
          let isWinning = ethers.utils.parseBytes32String(proposal[3]);
          this.ballotProposalsDisplay?.push({
            idx: idx,
            name: name,
            voteCount: voteCount,
            isWinning: isWinning,
          });
          console.log(
            'idx' +
              idx +
              'name' +
              name +
              'voteCount' +
              voteCount +
              'isWinning' +
              isWinning
          );
        });
      });
  }
}
