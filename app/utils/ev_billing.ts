


export type EvTariff = {

    tier: string;
    min_kwh: number;
    total_amount: number;
    penalties_fee: number;
    overstay_minutes: number;
}




type EvBilling = {
    energyCost: number;
    taxAmount: number;

    taxRate: number;
    ratePerKwh: number;
    parkingFee: number;
    totalCost: number;
    currency: string;
 
}


// Function for doing the calculation of the EV Billing


const  calculateEvBilling = (taxRate: number, ratePerKwh: number, parkingFee: number, kwhUsed: number, currency: string): EvBilling => {

    const numericInputs = { taxRate, ratePerKwh, parkingFee, kwhUsed };

    for (const [key, value] of Object.entries(numericInputs)) {
        if (!Number.isFinite(value) || value < 0) {
            throw new Error(`Invalid input for ${key}: ${value} the value cannot be negative or non-numeric`);
        }
    }

    if (typeof currency !== 'string' || !currency.trim()) {
        throw new Error(`Invalid input for currency: ${currency}`);
    }

    // destroying negative values we wants positive values only


    if (taxRate < 1){

        throw new Error(`Invalid input for taxRate: ${taxRate} the value cannot be less than 1`);
    }

    if (ratePerKwh === 0){
        throw new Error(`Invalid input for ratePerKwh: ${ratePerKwh} the value cannot be zero`);
    }

    if (parkingFee < 0){
        throw new Error(`Invalid input for parkingFee: ${parkingFee} the value cannot be negative`);
    }


    if (kwhUsed < 0){
        throw new Error(`Invalid input for kwhUsed: ${kwhUsed} the value cannot be negative`);
    }



    const roundValues = (value: number) => Math.round(value * 100) / 100;


    const energyCost = ratePerKwh * kwhUsed;
    const taxAmount = energyCost * taxRate;

    const roundedEnergyCost = roundValues(energyCost);
    const roundedTaxAmount = roundValues(taxAmount);
    const roundedParkingFee = roundValues(parkingFee);
    const roundedTotalCost = roundValues(roundedEnergyCost + roundedTaxAmount + roundedParkingFee);


    

    return {
        
        taxAmount: roundedTaxAmount,
        totalCost: roundedTotalCost,
        currency,
        energyCost: roundedEnergyCost,
        parkingFee: roundedParkingFee,
        taxRate: taxRate,
        ratePerKwh: ratePerKwh,
    };


    };







    
/// Logic for calculation the spendings in this section


const calculateEnergySpendings = (ratePerKwh: number, kwhUsed: number, period: 'daily' | 'weekly' | 'monthly' | 'yearly'): number => {

    switch(period){
        case 'daily':
            return ratePerKwh * kwhUsed;
        case 'weekly':
            return ratePerKwh * kwhUsed * 7;
        case 'monthly':
            return ratePerKwh * kwhUsed * 30;
        
        case 'yearly':
            return ratePerKwh * kwhUsed * 365;
        default:
            throw new Error('Invalid period. Please try again later');
    }
}







const calculateParkingSpendings = (parkingFee: number, period: 'daily' | 'weekly' | 'monthly' | 'yearly'): number => {


    switch(period){

        case 'daily':
            return parkingFee;
        case 'weekly':
            return parkingFee * 7;
        case 'monthly':
            return parkingFee * 30;
        case 'yearly':
            return parkingFee * 365;
        default:
            throw new Error('Invalid period. Please try again later');


    }

}

// Spending alerts based on defined limits

type AlertPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
type AlertLevel = 'ok' | 'warning' | 'exceeded';

const SPENDING_LIMITS: Record<AlertPeriod, { parking: number; energy: number }> = {
    daily: { parking: 2000, energy: 5000 },
    weekly: { parking: 10000, energy: 25000 },
    monthly: { parking: 40000, energy: 100000 },
    yearly: { parking: 50000, energy: 2000000 },
};

const WARNING_RATIO = 0.75;

const getAlertLevel = (spent: number, limit: number): AlertLevel => {
    if (spent >= limit) return 'exceeded';
    if (spent >= limit * WARNING_RATIO) return 'warning';
    return 'ok';
};


const calculateOverstay = ( startCharging: Date, endCharging: Date): number => {
 // PENALTIES FEE


 const overstayMinutes = Math.ceil((endCharging.getTime() - startCharging.getTime()) / (1000 * 60));


 try {

    if (Number.isNaN(overstayMinutes) || overstayMinutes < 0) {
        throw new Error('Invalid overstay duration');
    }
 } catch (error) {
    throw new Error('Error calculating overstay duration: ' + (error as Error).message);
 }




 const OVERSTAY_LIMITS = {
     SMALL: 15,
     MEDIUM: 30,
 };

 const PENALTIES = {
     SMALL: 50,
     MEDIUM: 100,
     LARGE: 200,
 };



         if (overstayMinutes <= 0) return 0;
         if (overstayMinutes <= OVERSTAY_LIMITS.SMALL) return PENALTIES.SMALL;
         if (overstayMinutes <= OVERSTAY_LIMITS.MEDIUM) return PENALTIES.MEDIUM;
         if (overstayMinutes > OVERSTAY_LIMITS.MEDIUM) return PENALTIES.LARGE;

         return 0;

}




// TRIGGERS some errors Number must be finite and non-negative values
const spendingAlerts = (energySpendings: number, parkingSpendings: number, period: AlertPeriod) => {
    if (!Number.isFinite(energySpendings) || energySpendings < 0 ||
        !Number.isFinite(parkingSpendings) || parkingSpendings < 0) {
        throw new Error('Spendings must be finite, non-negative numbers');
    }

    const limits = SPENDING_LIMITS[period];
    if (!limits) {
        throw new Error('Invalid period. Please try again later');
    }

    return {
        period,
        energy: { spent: energySpendings, limit: limits.energy, level: getAlertLevel(energySpendings, limits.energy) },
        parking: { spent: parkingSpendings, limit: limits.parking, level: getAlertLevel(parkingSpendings, limits.parking) },
    };
};


export { calculateEvBilling, calculateEnergySpendings, calculateParkingSpendings, spendingAlerts , calculateOverstay };

export default function () {
    return null;
}










