import { useEffect, useState } from "react";
import { Icons} from "./icons";



const dots = [
    {id: 1, className:"active-dot"},
    {id: 2, className: "second-dot"},
    {id: 3, className: "third-dot"}
] as const;


export { dots };

export type Dot = (typeof dots)[number];


export const dotseffect = (index = 0) => {
    const [currentDot, setCurrentDot] = useState(dots[index]);

    const nextDot = () => {
        const currentIndex = dots.findIndex(dot => dot.id === currentDot.id);
        const nextValue = (currentIndex + 1) % dots.length;
        setCurrentDot(dots[nextValue]);
    }

    const prevDot = () => {
        const currentIndex = dots.findIndex(dot => dot.id === currentDot.id);
        const prevValue = (currentIndex - 1 + dots.length) % dots.length;
        setCurrentDot(dots[prevValue]);
    }

    useEffect(() => {
        const interval = setInterval(nextDot, 3000);
        return () => clearInterval(interval);
    }, [currentDot]);

    return { currentDot, nextDot, prevDot };
}


 const ImgIcons =


  [

    {id: 1,  title: 
    "Pay Your Parking with E-tickets",
     subtitle: "E-tickets make parking payment easy. You can pay for your parking using our app, and receive an electronic ticket that you can show to the parking attendant.",
            icon: Icons.Car},
    {id: 2,  title: "Remember Your Parking Time", subtitle: "Set reminders for your parking duration whenever is necessary", icon: Icons.ParkingClock},
    {id: 3,  title: "ParkingTicket", subtitle: "Keep track of your parking tickets and you can use MOMO Mobile Payment", icon: Icons.ParkingTicket},

  ] as const;


  export const SlidingEffectIcons = (index=0) => {

        const [currentIcon, setCurrentIcon] = useState(ImgIcons[index]);


        const nextIcon = () => {

            const currentIndex = ImgIcons.findIndex(icon => icon.id === currentIcon.id);
            const nextValue = (currentIndex + 1) % ImgIcons.length;
            setCurrentIcon(ImgIcons[nextValue]);

        }


        const prevIcon = () => {
            const currentIndex = ImgIcons.findIndex(icon => icon.id === currentIcon.id);
            const prevValue = (currentIndex - 1 + ImgIcons.length) % ImgIcons.length;
            setCurrentIcon(ImgIcons[prevValue]);
        }

        
        useEffect(() => {
            const interval = setInterval(nextIcon, 3000);
            return () => clearInterval(interval);
        }, [currentIcon]);

        return { currentIcon, nextIcon, prevIcon };



  }