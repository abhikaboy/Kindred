import { View, Text, Dimensions, Image, TouchableOpacity } from 'react-native'
import React from 'react'
import { Colors } from '@/constants/Colors'
import PrimaryButton from '@/components/buttons/PrimaryButton'
import { Link, useRouter } from 'expo-router'

type Props = {}

/*
    Landing page when you open the app for the very first time

*/

const index = (props: Props) => {
    const router = useRouter()

  return (
    <View style={{
        backgroundColor: Colors["dark"].background,
        height: Dimensions.get("screen").height,
        flex: 1,
        flexDirection: "column",
    }}>
        <Image source={require("../assets/images/onboardHero.png")} style={{
            width: Dimensions.get("screen").width
        }}></Image>
        <View style={{
            paddingHorizontal: 24,
            width:"100%",
            height:"50%",
            flex: 1,
            flexDirection: "column"
        }}>
            <View style={{display: "flex", alignSelf: "flex-start"}}>

                <Text style={{
                    fontWeight: 700,
                    fontSize: 48,
                    color: Colors["dark"].header
                }}>
                    PRODUCTIVE MEETS SOCIAL
                </Text>
                <Text style={{
                    fontWeight: 300,
                    fontSize: 16,
                    color: Colors["dark"].text,
                    lineHeight: 24
                }}>
                    Become more productive and organized than ever before while staying connected with all your friends 
                </Text>
            </View>

            <View style={{
                flex:1,
                flexDirection: "column",
                gap: 24,
                width:"100%",
                justifyContent: "flex-end",
                bottom: 64
            }}>
                <PrimaryButton title="Get Started" onPress={() => router.push("/playground")}/>
                <Text style = {{
                    color: Colors["dark"].text,
                    textAlign: "center",
                    fontFamily: "outfit"
                }}>
                    Already have an account? <TouchableOpacity><Text style={{fontWeight: 800, color: "white"}} > Log in</Text></TouchableOpacity>
                </Text>
            </View>
    </View> 
    </View> 
  )
}

export default index