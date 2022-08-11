import { Address, ipfs, json } from "@graphprotocol/graph-ts"
import {
  ConfirmedAttendee,
  DepositsPaidOut,
  NewEventCreated,
  NewRSVP
} from "../generated/Web3RSVP/Web3RSVP"
import { Account, RSVP, Confirmation, Event } from "../generated/schema"
import { integer } from "@protofire/subgraph-toolkit";

export function handleNewEventCreated(event: NewEventCreated): void {
  let newEvent = Event.load(event.params.eventId.toHex());
  if (newEvent == null) {
    newEvent = new Event(event.params.eventId.toHex());
    newEvent.eventId = event.params.eventId;
    newEvent.eventOwner = event.params.creatorAddress;
    newEvent.eventTimestamp = event.params.eventTimestamp;
    newEvent.maxCapacity = event.params.maxCapacity;
    newEvent.deposit = event.params.deposit;
    newEvent.paidOut = false;
    newEvent.totalRSVPs = integer.ZERO;
    newEvent.totalConfirmedAttendees = integer.ZERO;

    let metadata = ipfs.cat(event.params.eventDataCID + "/data.json");

    if (metadata) {
      const value = json.fromBytes(metadata).toObject();
      if (value) {
        const name = value.get("name");
        const description = value.get("description");
        const link = value.get("link");
        const imagePath = value.get("image");

        if (name) {
          newEvent.name = name.toString();
        }


        if (description) {
          newEvent.description = description.toString();
        }


        if (link) {
          newEvent.link = link.toString();
        }


        if (imagePath) {
          const imageURL =
          "https://ipfs.io/ipfs/" +
          event.params.eventDataCID +
          imagePath.toString();
          newEvent.imageURL = imageURL;
        } else {
          // return fallback image if no imagePath
          const fallbackURL =
          "https://ipfs.io/ipfs/bafybeibssbrlptcefbqfh4vpw2wlmqfj2kgxt3nil4yujxbmdznau3t5wi/event.png";
          newEvent.imageURL = fallbackURL;
        }
      }
    }

    newEvent.save();
  }

}

function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address.toHex());
  if (account == null) {
    account = new Account(address.toHex());
    account.totalRSVPs = integer.ZERO;
    account.totalAttendedEvents = integer.ZERO;
    account.save();
  }
  return account;
}

export function handleNewRSVP(event: NewRSVP): void {
  let newRSVP = RSVP.load(event.transaction.from.toHex());
  let account = getOrCreateAccount(event.params.attendeeAddress);
  let thisEvent = Event.load(event.params.eventID.toHex());
  if (newRSVP == null && thisEvent != null) {
    newRSVP = new RSVP(event.transaction.from.toHex());
    newRSVP.attendee = account.id;
    newRSVP.event = thisEvent.id;
    newRSVP.save();
    account.totalRSVPs = integer.increment(account.totalRSVPs);
    account.save();
  }
}

export function handleConfirmedAttendee(event: ConfirmedAttendee): void {
  let id = event.params.eventID.toHex() + event.params.attendeeAddress.toHex();
  let newConfirmation = Confirmation.load(id);
  let account = getOrCreateAccount(event.params.attendeeAddress)
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let thisEvent = Event.load(event.params.eventID.toHex());
  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (newConfirmation == null && thisEvent != null) {
    newConfirmation = new Confirmation(id);
    newConfirmation.attendee = account.id;
    // Entity fields can be set using simple assignments
    newConfirmation.event = thisEvent.id;
    // Entities can be written to the store with `.save()`
    newConfirmation.save();
  }
}

// export function handleDepositsPaidOut(event: DepositsPaidOut): void {
//   let thisEvent = Event.load(event.params.eventID.toHex());
//   if (thisEvent) {
//     thisEvent.paidOut = true;
//     thisEvent.save();
//   }
// }
// Note: If a handler doesn't require existing field values, it is faster
// _not_ to load the entity from the store. Instead, create it fresh with
// `new Entity(...)`, set the fields that should be updated and save the
// entity back to the store. Fields that were not set or unset remain
// unchanged, allowing for partial updates to be applied.

// It is also possible to access smart contracts from mappings. For
// example, the contract that has emitted the event can be connected to
// with:
//
// let contract = Contract.bind(event.address)
//
// The following functions can then be called on this contract to access
// state variables and other data:
//
// - contract.idToEvent(...)
