import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { ethers } from 'ethers';
//import tokenJson directly to avoid the abi error, not import * as tokenJson
//import * as MyTokenJson from '../assets/MyToken.json';
import tokenJson from '../assets/MyToken.json';
//const tokenJson = MyTokenJson;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  provider: ethers.providers.Provider;
  wallet: ethers.Wallet | undefined;
  tokenContract: ethers.Contract | undefined;
  etherBalance: number | undefined;
  tokenBalance: number | undefined;
  votePower: number | undefined;
  tokenAddress: string | undefined;
  ballotProposals: [] | undefined;

  constructor(private http: HttpClient) {
    //http is injected in constructor and is available in all fns
    this.provider = ethers.providers.getDefaultProvider('goerli');
  }

  createWallet() {
    //this is not a promise, it is an observabel so cannot be awaited. Can subscribe
    //  instead of await
    console.log('About to subscribe');
    this.http
      .get<any>('http://localhost:3000/token-address')
      .subscribe((ans) => {
        this.tokenAddress = ans.result;

        console.log('Token addr is');
        console.log(ans.result + ', ' + this.tokenAddress);
        if (this.tokenAddress) {
          //if the address isn't null, do the wallet, contract, ...
          //this.wallet = new ethers.Wallet(userProvidedPrivateKey);
          this.wallet = ethers.Wallet.createRandom().connect(this.provider);
          //setup a token contract
          this.tokenContract = new ethers.Contract(
            this.tokenAddress,
            tokenJson.abi,
            this.wallet
          );
          //this.wallet.getBalance() returns a promise
          //need .then to wait for the promise resolution
          this.updateInfo();
        }
      });
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
        this.tokenContract['getVotes'](this.wallet.address).then(
          (votePowerBN: ethers.BigNumberish) => {
            this.votePower = parseFloat(ethers.utils.formatEther(votePowerBN));
          }
        );
      }
    }
  }

  //TODO await for this transaction to be completed
  claimTokens() {
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
    this.getballotInfo(ballotContractAddress);
  }

  delegate() {}

  castVote() {}

  getballotInfo(ballotContractAddress: string) {
    this.http
      .post<any>('http://localhost:3000/connect-ballot', {
        address: ballotContractAddress,
      })
      .subscribe((ans) => {
        this.ballotProposals = ans.result;
      });
  }
}
