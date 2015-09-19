/**
* @author Barret Lee(barret.china@gmail.com)
* @date 2014/08
* 
* MIT LICENSE
*/

;(function(window, undefined){

var curNum = 1               // 当前选择的球的个数
  , curDoubling = 1          // 当前的倍率
  , curRes = []              // 当前选中的所有球
  , curType = "standard"     // 当前算法方式
  , curFullName = "一星"     // 当前的玩法名字
  , curId = "SSC_1_1"        // 当前选中的 input 位置
  , CHECK_PASS = 1           // 状态检测 OK, 投注的 button 可以点击
  , CHECK_UNPASS = -1        // 状态检测不通过，投注的 button 不可以点击
  , textMsg = ""             // curType 为 Text 时，错误信息(不会显示，可作为强检测)
  
  // 设置倍率最大值
  , MAX_DOUBLING = $(".ssc-resluts-doubling em b").text() || 1000
  
  // 引入进来，减少作用域链的查询，达到优化程序的作用
  , ConfigParam = window.ConfigParam
  , ConfigDOM = window.ConfigDOM
  , ConfigClose = window.ConfigClose || []

  // 和值中需要用到的两个常量
  , TABLE_2 = (function(){
        var table2 = []
          , tableHash2 = {};

        for(var i = 0; i < ConfigParam['total']; i++){
            for(var j = i; j < ConfigParam['total']; j++){
                table2.push(i + j);  
            }
        }


        for(i = 0; i < table2.length; i++){
            if(!!!tableHash2[table2[i]]){
                tableHash2[table2[i]] = 1;
            } else {
                tableHash2[table2[i]] += 1;
            }
        }

        return tableHash2;
    })()
  , TABLE_3_1 = {0:1,1:3,2:6,3:10,4:15,5:21,6:28,7:36,8:45,9:55,10:63,11:69,12:73,13:75,
        14:75,15:73,16:69,17:63,18:55,19:45,20:36,21:28,22:21,23:15,24:10,25:6,26:3,27:1}
  , TABLE_3_2 = {1:1,2:2,3:1,4:3,5:3,6:3,7:4,8:5,9:4,10:5,11:5,12:4,13:5,
        14:5,15:4,16:5,17:5,18:4,19:5,20:4,21:3,22:3,23:3,24:1,25:2,26:1}
  , TABLE_3_3 = {3:1,4:1,5:2,6:3,7:4,8:5,9:7,10:8,11:9,12:10,13:10,
        14:10,15:10,16:9,17:8,18:7,19:5,20:4,21:3,22:2,23:1,24:1};


//=========================================================== SSC ==//

/**
 * SSC Class
 * 时时彩代码类，封装时时彩所需的各种函数
 *
 * @param {String|Object} con container
 */
var SSC = window.SSC = function(con){
    this.init(con);
};

$.extend(SSC.prototype, {
    init: function(con){
        // container
        this.$con = $(con).size() > 0 ? $(con) : $("#ssc");
        // 初始化 Tab
        this.tabSwitch();
        // 绑定点击
        this.bindUI();
        // 绑定多选 selector
        this.bindMultiSelector();

        //fix bug 
        $("#doubling").val(1);
    },
    getCurNum: function(){
        return curNum;
    },
    /**
     * @return {Number} 当前的倍率
     */
    getCurDoubling: function(){
        return Number(curDoubling);
    },
    /**
     * @return {String} 当前算法方式
     */
    getCurType: function(){
        return curType;
    },
    /**
     * @return {Array} 当前选中的所有球
     */
    getCurRes: function(){
        return curRes;
    },
    /**
     * 手工录入，错误信息提示
     */
    getTextMsg: function(){
        return textMsg;
    },
    /**
     * 玩法配置，关闭某些玩法，开始前的预处理
     */
    preprocessor: function(pos){
        if(pos.length == 0) return;

        var POSITION = [];
        for(var i = 0; i < pos.length; i++){
            POSITION.push(pos[i].join());
        }

        // 预处理配置文件
        for(var tab in ConfigDOM){
            for(i = 0; i < ConfigDOM[tab].length; i++){
                var sub = ConfigDOM[tab][i];
                if(!!!sub["group"]){
                    if($.inArray(sub["pos"].join(), POSITION) > -1){
                        ConfigDOM[tab].splice(i, 1);
                        i--;
                    }
                } else {
                    for(var j = 0; j < sub["data"].length; j++){
                        if($.inArray(sub["data"][j]["pos"].join(), POSITION) > -1){
                            ConfigDOM[tab][i]["data"].splice(j, 1);
                            j--;
                        }
                    }
                }
            }
        }

        // 遍历数组是否为空
        for(var key in ConfigDOM){
            if(ConfigDOM[key].length == 0){
                delete ConfigDOM[key];
                continue;
            }
            if(ConfigDOM[key][0]["data"]){
                for(j = 0; j < ConfigDOM[key].length; j++){
                    if(ConfigDOM[key][j]["data"].length == 0){
                        ConfigDOM[key].splice(j, 1);
                        j--;
                    }
                }
                if(ConfigDOM[key].length == 0){
                    delete ConfigDOM[key];
                }
            }
        }
    },
    /**
     * [tabSwitch 绑定顶部的 Tab 和联动的 SubTab]
     */
    tabSwitch: function(){
        var self = this;

        // 预处理
        self.preprocessor(ConfigClose);

        // 插入顶部 Tab
        $(".ssc-num").html(DOMHelper.createTab());

        // subTab bind
        self.$con.on("change", ".ssc-type input", function(){
            self.$con.find(".ssc-tip").html("[玩法介绍]：" + $(this).attr("data-tip"));

            curId = $(this).attr("id");
            curFullName = $(this).attr("data-type");

            self.bollLinkage();
        });

        // 绑定顶部 Tab 的点击事件
        self.$con.on("click", ".ssc-num a", function(evt){
            evt.preventDefault();

            // 添加选中样式
            $(".ssc-num a").removeClass("ssc-num_on");
            $(this).addClass("ssc-num_on");

            var item = $(this).text();

            /** 
             * 联动的中间处理，设置各种 Cur 状态值
             */
            self.setCurAttr(item);

            // 获取需要渲染的数据
            for(var key in ConfigDOM){
                if(key === item){
                    item = ConfigDOM[key];
                    break;
                }
            }
            // 默认不存在分组
            var tplTag = 0; 

            // 标记是否存在分组
            if(!!item[0].data) {
                tplTag = 1;
            }

            // 使用模板引擎生成 SubTab
            item = Utils.tplEngine(DOMHelper.createSubTab(tplTag), item);

            // 插入 SubTab
            $(".ssc-type").html(item).find("input")
                .eq(0).trigger("change")
                .get(0).checked = "checked";

        }).find(".ssc-num a").eq(0).trigger("click");

    },

    /**
     * setCurAttr 根据 TAB 确定当前的球数
     * @param {String} text Tab中的文案
     */
    setCurAttr: function(text){
        // 设置当前球的个数
        var table = "一二三四五六七八九".split("");

        if(text.match(new RegExp("(" + table.join("|") + ")"))){
            // 球数设置
            curNum = $.inArray(RegExp.$1, table) + 1;
        } else {
            // 大小单双
            curNum = -1;
        }
    },

    /**
     * bollLinkage 根据 SubTab 中的 id 属性来判断当前的算法
     * 并渲染各行球的展示
     */
    bollLinkage: function(){
        var self = this;

        if(/(1|2|3|4|5|6)_1|6_3/.test(curId)){
            // 标准选号, 6_3为通选
            curType = "standard";
        }
        if(/2_4|3_2|4_3|4_6/.test(curId)){
            // 和值
            curType = "sum";
        }
        if(/2_3|4_(2|5)/.test(curId)){
            // 包号
            curType = "bh";
        }
        if(/2_5|3_3|4_7/.test(curId)){
            // 胆拖
            curType = "dt";
        }
        if(/3_4/.test(curId)){
            // 跨度
            curType = "kd";
        }
        if(/2_(2|6)|3_5|4_(4|8)|6_(2|4)/.test(curId)){
            // 手工录入
            curType = "text";
        }
        if(/7_1/.test(curId)){
            // 大小单双
            curType = "dxds";
        }
        if(/(8|9)_1/.test(curId)){
            // 任选一、二
            curType = "rx";
        }

        // console.log(curType, curId);

        // 重置DOM
        $(".CSR_clear").trigger("click");

        // 创建球区块
        var str = DOMHelper.createBollLine();
        // 插入到 DOM 中
        $(".ssc-main-choose").html(str);

        // 绑定 selector
        self.bindUISelector();

        // 三星组选特殊处理，第二行置灰，不可点击，并与第一行联动
        if(/4_1/.test(curId)){
            // 去除十位机选
            $(".ssc-selector-item").eq(0).find("select, a").hide();
            $(".ssc-selector-item").eq(1).find("select, a").hide();

            $(".ssc-selector-item").eq(1).find("span strong").addClass("ssc-selector-item_gray")
            .off().on("click", function(evt){
                evt.stopPropagation();
            });

            $(".ssc-selector-item").eq(0).find("span strong").on("click", function(){
                var index = $(this).parents("span").index();
                $(".ssc-selector-item").eq(1).find("span strong").eq(index - 1).toggleClass("ssc-selector-item_on");
            });
        }

        // 胆拖特殊处理，胆码数量不超过 curNum - 1 个，并且胆码和拖码不重复
        if(curType == "dt"){
            $(".ssc-selector-item span strong").on("click", function(evt){
                var $p = $(this).parents(".ssc-selector-item")
                  , index = $p.index()
                  , $sib = $p.siblings(".ssc-selector-item")
                  , curObjIndex = $(this).parents("span").index();

                if((index == 0) && !$(this).hasClass("ssc-selector-item_on")
                 && $(".ssc-selector-item").eq(0).find(".ssc-selector-item_on").size() >= curNum - 1){
                    self.alertBox("亲，胆码数量不能超过 " + (curNum - 1) + " 个~");

                    evt.stopImmediatePropagation();
                    return;
                }

                $sib.find("span strong").eq(curObjIndex - 1).removeClass("ssc-selector-item_on");

            });
        }
    },

    /**
     * UI 绑定中心，几乎所有的 DOM 绑定都在这里
     */
    bindUI: function(){
        var self = this;

        $(".ssc-resluts-doubling em b").text(MAX_DOUBLING);

        // 绑定球的点击
        $(".ssc-main-choose").on("click", "span strong", function(){
            $(this).toggleClass("ssc-selector-item_on");

            // 刷新当前状态
            self.refresh().init();
        });

        // 当 Text 内容发生变化的时候，刷新当前状态
        $(".ssc-main-choose-text textarea").on("change keyup focus propertychange", function(){

            // 刷新当前状态
            self.refresh().init(); 
        });

        // 清空选择
        $(".CSR_clear").on("click", function(evt){
            evt.preventDefault();

            // 重置
            self.refresh().resetDom();
        });

        // 删除  
        $(".ssc-resluts-list").on("click", "a", function(evt){
            evt.preventDefault();

            $(this).parent().hide(0, function(){
                var $this = $(this);
                setTimeout(function(){
                    $this.remove();
                    self.refresh().setFinal();
                }, 16);
            });
        });

        // 点击添加样式
        $(".ssc-resluts-list").on("click", "div", function(evt){
            evt.preventDefault();

            $(this).addClass("ssc-resluts-list_active")
                .siblings().removeClass("ssc-resluts-list_active");
        });

        // 点击清空内容
        $(".ssc-resluts-doubling a").on("click", function(evt){
            evt.preventDefault();

            $(".ssc-resluts-list").html("");
            self.refresh().setFinal();
        });

        // 点击改变倍率
        $(".ssc-resluts-doubling i").on("click", function(){
            var index = $(this).index();
            var $val = $("#doubling");

            var val = Number($val.val());
            if(index == 0){
                $val.val( val - 1 > 0 ? val - 1 : 1);
            } else {
                $val.val(val + 1);
            }

            curDoubling = $val.val();
            $(".ssc-resluts-doubling input").triggerHandler("change");
        });

        // 倍率检测
        $(".ssc-resluts-doubling input").on("change keyup blur", function(){
            if(!/^\d+$/.test($(this).val())){
                $(this).val(curDoubling);
                return;
            }
            if(parseInt($(this).val()) >= MAX_DOUBLING){
                $(".ssc-resluts-doubling em").show();
                $(this).val(curDoubling);
                return;
            } else {
                $(".ssc-resluts-doubling em").hide();
            }
            self.refresh().setFinal();
        });
    },

    /**
     * 绑定 select 变化时的触发动作
     */
    bindUISelector: function(){
        var total = ConfigParam['total']
          , half = total%2 == 1 ? Math.ceil(total / 2) - 1 : total / 2
          , rnum = []
          , funcPool = {   // 用于操作球的选中状态
                "all": function(index, me){
                    $(me).addClass("ssc-selector-item_on");
                },
                "big": function(index, me){
                    index >= half
                        && $(me).addClass("ssc-selector-item_on");
                },
                "small": function(index, me){
                    index < half
                        && $(me).addClass("ssc-selector-item_on");
                },
                "odd": function(index, me){
                    index % 2 == 0
                        && $(me).addClass("ssc-selector-item_on");
                },
                "even": function(index, me){
                    index % 2 == 1
                        && $(me).addClass("ssc-selector-item_on");
                },
                "other": function(index, me){
                    $.inArray(index, rnum) > -1
                        && $(me).addClass("ssc-selector-item_on");
                }
            }
        , self = this;

        // 当 select 的值发生变化的时候，修改球的选中状态
        $(".ssc-main-choose").on("change", ".ssc-selector-item select", function(){
            var $this = $(this)
              , $items = $this.parents(".ssc-selector-item").find("span strong")
              , val = $this.val();

            self.refresh().resetDom("don't remove all selector status, just a line");
            $items.removeClass("ssc-selector-item_on");

            if(!isNaN(parseInt(val))){
                rnum = Utils.getSomeRandom(parseInt(val));
                val = "other";
            }

            $items.map(funcPool[val]);
                
            // 刷新当前状态
            self.refresh().init();
        });

        // select 旁边 button 点击选择
        $(".ssc-selector-item select").next("a").on("click", function(evt){
            evt.preventDefault();

            $(this).prev("select").trigger("change");
        });
    },

    /**
     * 选择球 -> 刷新变量 -> 判断 button 是否可以点击
     *
     * @return {Objet} 这是比较关键的一块，主要用于状态判断
     * 
     *      init: function(){            // 刷新当前选中球,并判断是否置灰button
     *          setCurRes();
     *          unDisableBtn();
     *      },
     *      setCurRes: setCurRes,        // 刷新当前选中球
     *      unDisableBtn: unDisableBtn,  // 判断是否置灰button
     *      resetDom: resetDom,          // 重置DOM
     *      setFinal: setFinal           // 设置底部的注数和金额
     */
    refresh: function(){
        var self = this;

        /**
         * 刷新当前选中球
         */
        var setCurRes = function(){
            var res = [];
            $(".ssc-selector-item").each(function(){
                var arr = [];
                $(this).find(".ssc-selector-item_on").map(function(index, me){
                    arr.push($(me).text());
                });
                res.push(arr);
            });

            curRes = res;
        };

        /**
         * 判断是否置灰button
         */
        var unDisableBtn = function(){
            var count = self.countor();

            if(count == CHECK_UNPASS){
                // 数字归零
                $(".CSR_info").find("span").eq(0).text("0").end().eq(1).text("0.00");
                $(".CSR_get").find("span").eq(0).text("0.00").end().eq(1).text("0.00");

                // 置灰 button
                $(".CSR_btn").off().removeClass("CSR_btn_OK");

                return;
            }

            $(".CSR_info").find("span").eq("0").text(count) 
                .end().eq(1).text(count * 2);

            var money = self.calcMoney()
              , award = parseInt($(".CSR_info span").eq(1).text())
              , profit = money.indexOf("~") == -1 ? parseInt(money) - award : (function(){
                  return money.replace(/(\d+)/g, function(s, a){
                      return Number(a) - award;
                  });
              })(money);

            $(".CSR_get").find("span").eq(0).text(money).end().eq(1).text(profit);

            // 绑定点击
            $(".CSR_btn").addClass("CSR_btn_OK").off().one('click', function(evt){
                evt.preventDefault();

                if(curType == "text" && textMsg != ""){
                    // 重置DOM
                    $(".CSR_clear").trigger("click");
                    self.alertBox(textMsg);
                    return;
                }

                // 添加一条数据到下方的展示框中
                self.addResItem();
                // 重置DOM
                $(".CSR_clear").trigger("click");
                // 修改
                setFinal();
            });
        };

        // 重置DOM
        var resetDom = function(tag){
            // 数字归零
            $(".CSR_info").find("span").eq(0).text("0").end().eq(1).text("0.00");
            $(".CSR_get").find("span").eq(0).text("0.00").end().eq(1).text("0.00");

            // 选中状态取消
            !tag && $(".ssc-selector-item span strong").removeClass("ssc-selector-item_on");

            // 选择 button 置灰
            $(".CSR_btn").off().removeClass("CSR_btn_OK");

            // 只有标准选号才支持机选
            if(curType == "standard"){
                $(".CSR_select").show();
            } else {
                $(".CSR_select").hide();
            }

            // 如果是 text，清空内容
            if(curType == "text"){
                $(".ssc-main-choose-text textarea").val("");
                $(".CSR_info, .CSR_get").hide();
            } else {
                $(".CSR_info, .CSR_get").show();
            }

            $(".CSR_select option").get(0).selected = "selected";
        };

        // 设置底部的注数和金额
        var setFinal = function(){
            var val = 0;

            curDoubling = $("#doubling").val();

            $(".ssc-resluts-list div").each(function(index, me){
                val += Number($(me).find("i").eq(0).text());
            });

            $(".ssc-resluts-doubling strong").eq(0).text(val)
                .end().eq(1).text(val * curDoubling * 2 || "0.00");
        };

        return {
            init: function(){
                setCurRes();
                unDisableBtn();
            },
            setCurRes: setCurRes,
            unDisableBtn: unDisableBtn,
            resetDom: resetDom,
            setFinal: setFinal
        }
    },

    /**
     * 算法核心
     * @return {Number} 注数
     */
    countor: function(){
        var self = this
          , ret = 1
          , sum = 0
          , a = curRes[0] && curRes[0].length || 0
          , b = curRes[1] && curRes[1].length || 0;

        switch(curType){
            case "standard":  // 标准
                for(var i = 0; i < curNum; i++){
                    ret *= (curRes[i] && curRes[i].length) || 0;
                }

                if(/4_1/.test(curId)){
                    var c = curRes[2] && curRes[2].length || 0;
                    if(a == 0 || c == 0) return CHECK_UNPASS;
                    ret = a * c - Utils.arrayIntersection(curRes[0], curRes[2]).length;
                }

                return ret == 0 ? CHECK_UNPASS : ret;

            case "rx":        // 任选
                if(curNum == 1){
                    for(var i = 0; i < ConfigParam['stars']; i++){
                        sum += curRes[i] && curRes[i].length || 0;
                    }
                    return sum == 0 ? CHECK_UNPASS : sum;

                } else if(curNum == 2){
                    for(var i = 0; i < ConfigParam['stars'] - 1; i++){
                        for(var j = i + 1; j < ConfigParam['stars']; j++){
                            sum += (curRes[i] && curRes[i].length || 0) * (curRes[j] && curRes[j].length || 0)
                        }
                    }
                    return sum == 0 ? CHECK_UNPASS : sum;
                }

            case "text":      //  直接上传
                return this._getTextPatternContent();

            case "dxds":      // 大小单双
                ret = a * b;
                return ret == 0 ? CHECK_UNPASS : ret;

            case "bh":        // 包号
                // 二星
                if(/2_3/.test(curId)){
                    for(var i = 1; i <= a; i++){
                        sum += i;
                    }
                    return a < 3 || sum == 0 ? CHECK_UNPASS : sum;
                }
                // 三星组三
                if(/4_2/.test(curId)){
                    return a < 2 ? CHECK_UNPASS : a * (a - 1);
                }
                // 三星组六
                if(/4_5/.test(curId)){
                    return a < 3 ? CHECK_UNPASS : Utils.combination(a, 3);
                }
            case "sum":        // 和值
                var ret = [], TB;
                for(var i = 0; i < curRes.length; i++){
                    ret = ret.concat(curRes[i]);
                }
                if(curNum == 2){
                    TB = TABLE_2;
                }
                if(/3_2/.test(curId)){
                    TB = TABLE_3_1;
                }
                if(/4_3/.test(curId)){
                    TB = TABLE_3_2;
                }
                if(/4_6/.test(curId)){
                    TB = TABLE_3_3;
                }

                $.each(ret, function(index, item){
                    sum += TB[Number(item)];
                });

                return sum == 0 ? CHECK_UNPASS : sum;

            case "kd":        // 跨度，不知道算法，硬编码
                var table = [10, 54, 96, 126, 144, 150, 144, 126, 96, 54];
                $.each(curRes[0], function(index, item){
                    sum += table[Number(item)];
                });

                return sum == 0 ? CHECK_UNPASS : sum;

            case "dt":        // 胆拖
                if(a > 0 && b > 0 && a + b >= curNum){
                    if(/4_7/.test(curId) && a + b == curNum){
                        return CHECK_UNPASS;
                    }
                    // 直选，采用排列，组选，使用组合
                    ret = Utils.permutation(b, curNum - a) * Utils.permutation(curNum, a);

                    if(/4_7|2_5/.test(curId)){
                        ret = Utils.combination(b, curNum - a);;
                    }

                    return ret;
                } else {
                    return CHECK_UNPASS;
                }

            default:
                return CHECK_PASS;

        }
    },

    /**
     * 计算金额，可能是一个区间值
     * @return {[type]} [description]
     */
    calcMoney: function(){
        var text = $(".ssc-tip").text()
          , ret = text.match(/([\d+?\.?\d+?万]+)(?=元)/g);

        if(!!!ret){
            /**! 
             * 请规范化玩法介绍中文案的呈现，奖金后面加上"元"作为单位，
             * 并使用阿拉伯数字以及万来表示金额
             */
            self.alertBox("程序出错！");
        }

        $.each(ret, function(index, item){
            !/^[\d\.]+$/.test(item) && (ret[index] = Number(item.slice(0, -1)) * 10000);
        });

        // 二星组选和值时，返回一个区间
        if(/2_4/.test(curId)){
            return ret[ret.length - 2] - 50 - 16 + "~" + (ret[ret.length - 2] - 16)
        }
        return ret[ret.length - 1] + "";
    },

    /**
     * 添加一条选择记录
     */
    addResItem: function(data){
        var count = 0, content;

        switch(curType){
            case "standard": // 标准选球
            case "rx":       // 任选
                for(var i = 0; i < ConfigParam['stars']; i++){
                    if(curRes[i] == undefined || curRes[i] == "*") {
                        count++;
                    } else {
                        curRes[i] = curRes[i].join(",");
                    }
                }
                while(count--){
                    curRes.unshift("*");
                }
                content = curRes.join("|");
                break;
            case "text":
                $.map(curRes, function(ctt){
                    if($.trim(ctt) != "") {
                        content = ctt.replace(/\s+|,/g, ",");

                        $(".ssc-resluts-list").append(
                            DOMHelper.createResItemTpl(
                                $.extend({content: " " + content + " "}, data || {})
                            )
                        );
                    }
                });
                return;
            case "dxds":     // 大小单双
                content = curRes[0].join(",") + "|" + curRes[1].join(",");
                break;
            case "sum":      // 和值
            case "kd":       // 跨度
                content = curRes.join("|").replace("|", ",");
                break;
            case "bh":       // 包号
                content = curRes[0].join(",");
                break;
            case "dt":       // 胆拖
                content = curRes[0].join(",") + "#" + curRes[1].join(",");
                break;
            default:         // 默认
                content = " 『模板错误』 ";
        }

        $(".ssc-resluts-list").append(
            DOMHelper.createResItemTpl($.extend({content: " " + content + " "}, data || {}))
        );
        
        // 结果列表的滚动条滚到底部
        $(".ssc-resluts-list").scrollTop($(".ssc-resluts-list").children().size()*24);
    },

    /**
     * 当 curType 为 text 时，获取 text 中每一行的球信息
     * 检测无误则返回数据
     * 
     * @return {Array} 球信息数组
     */
    _getTextPatternContent: function(){
        var val = $(".ssc-main-choose-text textarea").val().split(/\n/m)
          , arrText = []
          , self = this;

        for(var i = 0; i < val.length; i++){
            val[i] = $.trim(val[i]);
        }

        // 重置 Text 错误信息
        textMsg = "";

        if(!!!$(".ssc-main-choose-text textarea").val()){
            textMsg = "输入不能为空";
            return CHECK_UNPASS;
        }

        for(var i = 0; i < val.length; i++){
            if($.trim(val[i]) == "") continue;

            var arrTmp = val[i].split(/\s+|,/);
            var hashTable = {"length": 0};

            var count = 0;
            for(var k = 0; k < arrTmp.length; k++){
                if(arrTmp[0] == arrTmp[k]) count++;
            }

            if(count == arrTmp.length){
                textMsg = "您好，您输入的第" + (i + 1) + "行的格式有误 [输入的每个数字都相等] ，请检查！";
                return CHECK_UNPASS;
            }
            // 输入数值错误，数值区间应该是 1 - totalNum
            for(var j = 0; j < arrTmp.length; j++){
                var valTmp = parseInt(arrTmp[j]);
                if(valTmp > ConfigParam['total'] - 1 || valTmp < 0){
                    textMsg = "您好，您输入的第" + (i + 1) + "行的格式有误 [输入数值错误，数值区间应该是 1 - "+
                        (ConfigParam["total"] - 1) +"] ，请检查！";
                    return CHECK_UNPASS;
                }
                if(hashTable[arrTmp[j]] == null){
                    hashTable[arrTmp[j]] = 1;
                    hashTable.length += 1;
                }
                if(!!!valTmp){
                    textMsg = "您好，您输入的第" + (i + 1) + "行的格式有误 [最后多了逗号？] ，请检查！";
                    return CHECK_UNPASS;
                }
            }

            // 个数错误，应该是 curNum 个
            if(arrTmp.length != curNum){
                textMsg = "您好，您输入的第" + (i + 1) + "行的格式有误 [个数错误，应该是" + 
                    curNum + "个] ，请检查！";
                return CHECK_UNPASS;
            }
        }

        curRes = val;

        return CHECK_PASS;
    },

    /**
     * 弹出层，可扩展
     */
    alertBox: function(msg){
        alert(msg);
    },

    /**
     * 机选多注的 select 绑定
     */
    bindMultiSelector: function(){
        var self = this;

        $(".CSR_select").on("change", function(){
            var val = +$(this).val();
            if(val == 0) return;

            for(var s = 0; s < val; s++){

                curRes.length = 0;

                if(curType == "standard" && curFullName.indexOf("三星组选") > -1) {
                    curRes[0] = curRes[1] = [Utils.getRandom()];
                    curRes[2] = [Utils.getRandom()];
                } else{
                    for(var i = 0; i < curNum; i++){
                        curRes.push([Utils.getRandom()]);
                    }
                }

                self.addResItem({
                    "num": 1,
                    "money": 2
                });
            }

            // 刷新当前状态
            self.refresh().setFinal();
            self.refresh().resetDom();
        });
    }
});


//================================================= SSC/DOMHelper ==//

/**
 * DOMHelper Class
 * 生成 DOM 元素
 *
 * @method init 初始化函数 DOMHelper的函数入口
 * @method createTab 生成顶部 TAB
 */
var DOMHelper = $.extend({}, {

    /**
     * 生成顶部 TAB
     * @return {[type]} [description]
     */
    createTab: function(){
        var str = []
          , i = 0;

        // 遍历配置文件
        for(var key in ConfigDOM){
            str.push('<a href="#" ' + (i++ == 0 ? 'class="ssc-num_on"' : '') + 
                '>' + key + '</a>|');
        }

        return str.join("");
    },
    /**
     * [createSubTab 创建 SubTab，input 框和 tip 信息]
     * @param  {Boolean} tplTag 表示是否存在分组
     * @return {String}        生成拼接好的字符串
     */
    createSubTab: function(tplTag){
        // 在注释前加入 "!" 可以防止压缩工具过滤注释
        // 下面用到的模板引擎是 Utils 函数中的 tplEngine。
        return tplTag ? (function(){
            return [
                '<div class="ssc-type-choose">',
                '    <%for(var i = 0; i < this.length; i++){%>',
                '    <span>',
                '        <strong><%this[i]["group"]%>：</strong>',
                '        <%for(var j = 0; j < this[i]["data"].length; j++){',
                '            var tmp = this[i]["data"][j];',
                '            var id = "SSC_" + tmp["pos"][0] + "_" + tmp["pos"][1];',
                '        %>',
                '        <input type="radio" id="<%id%>" data-type="<%tmp["type"]%>" data-tip="<%tmp["intro"]%>" name="ctype" />',
                '        <label for="<%id%>"><%tmp["m"]%></label>',
                '        <%}%>',
                '    </span>',
                '    <%}%>',
                '</div>',
                '<div class="ssc-tip">[玩法介绍]：<% this[0]["data"][0]["intro"]%></div>'
            ].join("\n");
        })() : (function(){
            return [
                '<div class="ssc-type-choose">',
                '    <span>',
                '        <%for(var i = 0; i < this.length; i++){',
                '            var id = "SSC_" + this[i]["pos"][0] + "_" + this[i]["pos"][1];',
                '        %>',
                '        <input type="radio" id="<%id%>" data-type="<%this[i]["type"]%>" data-tip="<%this[i]["intro"]%>" name="ctype" />',
                '        <label for="<%id%>"><%this[i]["m"]%></label>',
                '        <%}%>',
                '    </span>',
                '</div>',
                '<div class="ssc-tip">[玩法介绍]：<%this[0]["intro"]%></div>'
            ].join("\n");
        })();
    },

    /**
     * 创建球区块右侧的 select
     * @param  {Number} num 开始数
     * @return {String}     DOMString
     */
    ceateItemListSelect: function(num){
        var ret = ["<select>"]
          , opts = {
                "all": "全部",
                "big": "大",
                "small": "小",
                "odd": "偶数",
                "even": "奇数"
            };

        for(var i = num; i <= ConfigParam['total'] - 1; i++){
            ret.push("<option value='" + i + "'>机选" + i + "个</option>");
        }

        for(i in opts){
            ret.push("<option value='" + i + "'>机选" + opts[i] + "</option>");
        }
        ret.push("</select>");

        return ret.join("");
    },

    /**
     * 创建球区块
     * @return {String} DOMString
     */
    createBollLine: function(){
        var self = this
          , ret = ""
          , leftText = [];

        /**
        * @description 多行球的展示
        * @param {Number} line 行数，默认为1
        * @param {Array} table 左侧文案
        * @param {Boolean} tag 是否显示右侧select
        * @return {String} 返回拼接好的字符串
        */
        var chooseLineTpl = function(line, table, tag){  // standard
            var N = ConfigParam['total'] || 10
              , table = table || []
              , str = [];

            for(var s = 0; s < line; s++){
                str = str.concat([
                    '<div class="ssc-selector-item">',
                    '<span class="CSI_label"><i>' + (table[s] || '选择号码') + '</i><em>遗漏</em></span>'
                ]);

                for(var i = 0; i < N; i++){
                    str.push("<span><strong>" + i + "</strong><em>*</em></span>");
                }

                str = str.concat([
                    (typeof tag == "undefined" || !!tag) ? DOMHelper.ceateItemListSelect(1) 
                        + '<a href="#" class="btn">机选号码</a>' : "",
                    '</div>'
                ]);
            }

            return str.join("\n");
        };

        /**
        * @description 多行球的和值展示
        * @param {Number} a 和值的最小值
        * @param {Number} b 和值的最大值
        * @param {Number} line 需要拼接的行数
        * @return {String} 返回拼接好的字符串
        */
        var chooseSumTpl = function(a, b, line){  // sum
            var len = b - a + 1
              , perLine = Math.floor(len / line)
              , ret = "";

            for(var s = 0; s < line; s++){
                var str = [
                    '<div class="ssc-selector-item">',
                    '<span class="CSI_label"><i>和值数</i><em>遗漏</em></span>'
                ];

                for(var i = a + perLine * s; i < a + perLine * (s + 1); i++){
                    str.push("<span><strong>" + i + "</strong><em>*</em></span>");
                }

                str = str.concat([
                    '</div>'
                ]);

                ret += str.join("\n\t");
            }

            return ret;
        };

        /**
        * @description 多行球的大小单双展示
        * @return {String} 返回拼接好的字符串
        */
        var chooseDXDSTpl = function(){  // dxds
            var text = ["十位", "个位"];
            var table = "大小单双".split("");

            for(var s = 0; s < 2; s++){
                var str = [
                    '<div class="ssc-selector-item">',
                    '<span class="CSI_label"><i>' + text[s] + '</i><em>遗漏</em></span>'
                ];

                for(var i = 0; i < 4; i++){
                    str.push("<span><strong>" + table[i] + "</strong><em>*</em></span>");
                }

                str.push('</div>');

                ret += str.join("\n\t");
            }

            return ret;
        };


        $(".ssc-main-choose").show();
        $(".ssc-main-choose-text").hide();

        var table = "个位,十位,百位,千位,万位,十万位,百万位,千万位".split(",");
        switch(curType){
            case "standard":
                table = table.slice(0, curNum).reverse();
                ret = chooseLineTpl(curNum, table);
                break;
            case "sum":  // 和值
                var start = 0
                  , end = 18
                  , line = 1;

                if(curNum == 3 && !!~curId.indexOf("4_3")){
                    start = 1, end = 26, line = 2;
                }
                if(curNum == 3 && !!~curId.indexOf("3_2")){
                    start = 0, end = 27, line = 2;
                }
                if(curNum == 3 && !!~curId.indexOf("4_6")){
                    start = 3, end = 24, line = 2;
                }
                ret = chooseSumTpl(start, end, line);
                break;
            case "bh":   // 包号
                table = ['号码'];
                ret = chooseLineTpl(1, table);
                break;
            case "dt":   // 胆拖
                table = ['胆码', '拖码'];
                ret = chooseLineTpl(2, table, false);
                break;
            case "kd":   // 跨度
                table = ['跨度'];
                ret = chooseLineTpl(1, table);
                break;
            case "text": // 手工录入
                $(".ssc-main-choose, .ssc-main-choose-text").toggle();
                break;
            case "dxds": // 大小单双
                ret = chooseDXDSTpl();
                break;
            case "rx":   // 任选一、二
                ret = chooseLineTpl(ConfigParam['stars'], table);
                break;
            default:
                // 默认文案
                ret = "<strong>[ERROR]</strong> 配置参数有误，请注意查看 curType 参数是否设置";
        }

        return ret;
    },

    /**
     * 创建生成一条内容的模板
     * @param  {Object} data 参数
     * @return {String}      DOMString
     */
    createResItemTpl: function(data){
        var tpl = ['<div data-num="<%num%>" data-type="<%type%>">',
                    '<a href="#">删除</a>',
                    '<span>[<%type%>]</span>',
                    '<%content%>',
                    '(<i><%num%></i>注<i><%money%></i>元)',
                '</div>'].join("");

        // 模板数据
        var data = $.extend({
            "num": $(".CSR_info span").eq(0).text(),
            "money": $(".CSR_info span").eq(1).text(),
            'type': curFullName,
            "content": " 『模板错误』 "
        }, data || {});

        // 替换内容的模板
        return tpl.replace(/<%([^%>]+)?%>/g, function(m, a){
            return data[a];
        });             
    }
});


//================================================= SSC/Utils ==//

/**
* Utils Class
* 对ssc类的扩展，添加辅助工具
* 
* @method getRandom 获取随机数
* @method getSomeRandom 获取多个随机数
* @method tplEngine 模板引擎
* @method repeat 字符串重复
* @method arrayIntersection 数组交集
*/
var Utils = $.extend({}, {
    /**
    * @description 获取随机数
    * @param [Array] except 剔除的数
    * @return [Array] 返回一个数组
    */
    getRandom: function(except){

        var total = ConfigParam['total'] || 10;

        if(!except || except.length == 0){
            return Math.floor(Math.random()*total);
        }

        var res, tag = true;
        while(1 && tag){
            res = Math.floor(Math.random()*total);
            ($.inArray(res, except) == -1) && (tag = false);
        }
        return res == total ? res - 1 : res;
    },

    /**
    * @description 获取随机数
    * @param [Number] num 个数
    * @param [Array] except 获取多个随机数
    * @return [Array] 返回一个数组
    */
    getSomeRandom: function(num, except){
        var res = [], args;

        while(num--){
            if(except && res.length == 0){
                args = except;
            } else {
                args = Utils.unique((except || []).concat(res));
            }
            var tmp = this.getRandom(args);
            res.push(tmp);
        }

        return res;
    },

    /**
     * 清空重复数据
     * @param  {[type]} arr [description]
     * @return {[type]}     [description]
     */
    unique: function(arr){
        var hash = {}, i = 0, ret = [];

        for(; i < arr.length; i++ ) !hash[arr[i]] && (hash[arr[i]] = 1)
        for(i in hash) ret.push(Number(i));

        return ret;
    },

    // 模板引擎，详情可以异步我写的一篇博客
    // http://www.cnblogs.com/hustskyking/p/principle-of-javascript-template.html
    tplEngine: function(tpl, data) {
        var reg = /<%([^%>]+)?%>/g, 
            regOut = /(^( )?(if|for|else|switch|case|break|{|}))(.*)?/g, 
            code = 'var r=[];\n', 
            cursor = 0;

        var add = function(line, js) {
            js? (code += line.match(regOut) ? line + '\n' : 'r.push(' + line + ');\n') :
                (code += line != '' ? 'r.push("' + line.replace(/"/g, '\\"') + '");\n' : '');
            return add;
        }
        while(match = reg.exec(tpl)) {
            add(tpl.slice(cursor, match.index))(match[1], true);
            cursor = match.index + match[0].length;
        }
        add(tpl.substr(cursor, tpl.length - cursor));
        code += 'return r.join("");';
        return new Function(code.replace(/[\r\t\n]/g, '')).apply(data);
    },

    /**
     * 重复显示
     * @param  {[type]} str [description]
     * @param  {[type]} N   [description]
     * @return {[type]}     [description]
     */
    repeat: function(str, N){
        var res = ""
        while(N--){
            res += str;
        }
        return res;
    },

    // 组合
    combination: function(a, b){
        var resX = 1, resY = 1, tmp = b;
        while(tmp){
            resX *= a;
            a--;tmp--;
        }
        while(b){
            resY *= b;
            b--;
        }
        return resX / resY;
    },

    // 排列
    permutation : function(a, b){
        var ret = 1;
        while(b){
            ret *= a--;
            b--;
        }
        return ret;
    },

    /** 
    * @description 数据去重
    * @param {Array} a 要比较的数组
    * @param {Array} b 要比较的数组
    * @return {Array} a 和 b 的交集
    */
    arrayIntersection: function (a, b) {
      var ai = 0, bi = 0;
      var result = new Array();

      while( ai < a.length && bi < b.length ){
         if (a[ai] < b[bi] ){ 
            ai++; 
         } else if (a[ai] > b[bi] ){ 
            bi++; 
         } else {
            result.push(a[ai]);
            ai++;
            bi++;
         }
      }
      return result;
    }
});

})(window, undefined);